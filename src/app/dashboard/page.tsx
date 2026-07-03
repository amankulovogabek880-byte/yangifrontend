import {
  Module,
  Injectable,
  Controller,
  Get,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators';

// ════════════════════════════════════════════════════════════════════
// TOUR DASHBOARD — "Operatsion nazorat"
// Turagentlik uchun bosh sahifaning operatsion qismi:
//   • Bugun jo'nab ketadigan parvozlar
//   • Bugun qaytadigan parvozlar
//   • 7 kun ichida vizasi tugaydiganlar
//   • To'lov muddati o'tган (qarzdor) invoyslar
//
// ROL MANTIG'I (mavjud reports moduli bilan bir xil):
//   • AGENT           → faqat O'ZINING bookinglari/invoyslari (agentId = userId)
//   • TENANT_ADMIN /
//     MANAGER /
//     ACCOUNTANT      → butun agentlik (tenant) bo'yicha hammasi
//
// Barcha pul summalari bazada USD da saqlanadi (Booking.totalPrice,
// Invoice.totalAmount) — shuning uchun bu yerda ham USD qaytadi.
// ════════════════════════════════════════════════════════════════════

@Injectable()
export class TourDashboardService {
  private readonly logger = new Logger('TourDashboard');
  constructor(private prisma: PrismaService) {}

  private startOfDay(d = new Date()): Date {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  }
  private endOfDay(d = new Date()): Date {
    const x = new Date(d);
    x.setHours(23, 59, 59, 999);
    return x;
  }

  /**
   * Operatsion nazorat paneli uchun barcha ma'lumot — bitta so'rovda.
   * @param role AGENT bo'lsa faqat o'ziniki; aks holda butun tenant.
   */
  async cockpit(tenantId: string, userId: string, role: string) {
    const isAgent = role === 'AGENT';
    const bookingAgentFilter: any = isAgent ? { agentId: userId } : {};
    const invoiceAgentFilter: any = isAgent ? { agentId: userId } : {};

    const todayStart = this.startOfDay();
    const todayEnd = this.endOfDay();
    const in7Days = this.endOfDay(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));

    // ── Parallel so'rovlar ──────────────────────────────────────────
    const [departures, returns, visas, overdueInvoices] = await Promise.all([
      // 1) Bugun jo'nab ketadiganlar
      this.prisma.booking.findMany({
        where: {
          tenantId,
          ...bookingAgentFilter,
          status: { not: 'CANCELLED' },
          departureDate: { gte: todayStart, lte: todayEnd },
        },
        select: {
          id: true,
          bookingRef: true,
          tourName: true,
          destination: true,
          departureDate: true,
          airline: true,
          flightNumber: true,
          totalPrice: true,
          currency: true,
          client: { select: { id: true, fullName: true } },
          agent: { select: { id: true, name: true } },
          _count: { select: { passengers: true } },
        },
        orderBy: { departureDate: 'asc' },
      }).catch(() => [] as any[]),

      // 2) Bugun qaytadiganlar
      this.prisma.booking.findMany({
        where: {
          tenantId,
          ...bookingAgentFilter,
          status: { not: 'CANCELLED' },
          returnDate: { gte: todayStart, lte: todayEnd },
        },
        select: {
          id: true,
          bookingRef: true,
          destination: true,
          returnDate: true,
          client: { select: { id: true, fullName: true } },
          _count: { select: { passengers: true } },
        },
        orderBy: { returnDate: 'asc' },
      }).catch(() => [] as any[]),

      // 3) 7 kun ichida vizasi tugaydiganlar
      this.prisma.booking.findMany({
        where: {
          tenantId,
          ...bookingAgentFilter,
          status: { not: 'CANCELLED' },
          visaExpiryDate: { gte: todayStart, lte: in7Days },
        },
        select: {
          id: true,
          bookingRef: true,
          destination: true,
          visaExpiryDate: true,
          visaStatus: true,
          client: { select: { id: true, fullName: true } },
        },
        orderBy: { visaExpiryDate: 'asc' },
      }).catch(() => [] as any[]),

      // 4) To'lov muddati o'tган invoyslar (qarzdorlar)
      this.prisma.invoice.findMany({
        where: {
          tenantId,
          ...invoiceAgentFilter,
          dueDate: { lt: todayStart },
          status: { notIn: ['PAID', 'CANCELLED', 'REFUNDED'] as any },
        },
        select: {
          id: true,
          invoiceNumber: true,
          totalAmount: true,
          paidAmount: true,
          currency: true,
          dueDate: true,
          client: { select: { id: true, fullName: true } },
          booking: { select: { id: true, bookingRef: true, destination: true } },
        },
        orderBy: { dueDate: 'asc' },
      }).catch(() => [] as any[]),
    ]);

    // ── Jo'nab ketadiganlar uchun qoldiq (balance) ──────────────────
    // Har bir bookingга bog'liq invoyslardan (totalAmount - paidAmount)
    // yig'indisi = to'lanmagan qoldiq. Bitta so'rovda olib, map qilamiz.
    const depIds = departures.map((b: any) => b.id);
    const balanceByBooking: Record<string, number> = {};
    if (depIds.length > 0) {
      const depInvoices = await this.prisma.invoice
        .findMany({
          where: { tenantId, bookingId: { in: depIds } },
          select: { bookingId: true, totalAmount: true, paidAmount: true },
        })
        .catch(() => [] as any[]);
      for (const inv of depInvoices) {
        const owed = Math.max(0, (inv.totalAmount || 0) - (inv.paidAmount || 0));
        balanceByBooking[inv.bookingId] =
          (balanceByBooking[inv.bookingId] || 0) + owed;
      }
    }

    // ── Yig'indilar ─────────────────────────────────────────────────
    const sumPax = (arr: any[]) =>
      arr.reduce((s, b) => s + (b._count?.passengers || 0), 0);

    const overdueAmount = overdueInvoices.reduce(
      (s: number, inv: any) =>
        s + Math.max(0, (inv.totalAmount || 0) - (inv.paidAmount || 0)),
      0,
    );

    return {
      departuresToday: {
        count: departures.length,
        passengers: sumPax(departures),
        items: departures.map((b: any) => ({
          id: b.id,
          bookingRef: b.bookingRef,
          tourName: b.tourName,
          destination: b.destination,
          departureDate: b.departureDate,
          airline: b.airline || null,
          flightNumber: b.flightNumber || null,
          clientId: b.client?.id || null,
          clientName: b.client?.fullName || 'Noma\'lum',
          agentName: b.agent?.name || null,
          pax: b._count?.passengers || 0,
          balance: balanceByBooking[b.id] || 0,
          currency: b.currency || 'USD',
        })),
      },
      returnsToday: {
        count: returns.length,
        passengers: sumPax(returns),
        items: returns.map((b: any) => ({
          id: b.id,
          bookingRef: b.bookingRef,
          destination: b.destination,
          returnDate: b.returnDate,
          clientName: b.client?.fullName || 'Noma\'lum',
          pax: b._count?.passengers || 0,
        })),
      },
      visaExpiring: {
        count: visas.length,
        items: visas.map((b: any) => ({
          id: b.id,
          bookingRef: b.bookingRef,
          destination: b.destination,
          visaExpiryDate: b.visaExpiryDate,
          visaStatus: b.visaStatus || null,
          clientId: b.client?.id || null,
          clientName: b.client?.fullName || 'Noma\'lum',
        })),
      },
      overdue: {
        count: overdueInvoices.length,
        amount: overdueAmount,
        items: overdueInvoices.map((inv: any) => ({
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          balance: Math.max(0, (inv.totalAmount || 0) - (inv.paidAmount || 0)),
          currency: inv.currency || 'USD',
          dueDate: inv.dueDate,
          clientName: inv.client?.fullName || 'Noma\'lum',
          bookingRef: inv.booking?.bookingRef || null,
          bookingId: inv.booking?.id || null,
          destination: inv.booking?.destination || null,
        })),
      },
    };
  }
}

@ApiTags('reports')
@ApiBearerAuth('JWT')
@Controller('reports')
@UseGuards(JwtAuthGuard)
export class TourDashboardController {
  constructor(private readonly svc: TourDashboardService) {}

  /** GET /api/v1/reports/tour-cockpit — operatsion nazorat paneli */
  @Get('tour-cockpit')
  tourCockpit(@CurrentUser() u: any) {
    return this.svc.cockpit(u.tenantId, u.sub, u.role);
  }
}

@Module({
  controllers: [TourDashboardController],
  providers: [TourDashboardService],
  exports: [TourDashboardService],
})
export class TourDashboardModule {}