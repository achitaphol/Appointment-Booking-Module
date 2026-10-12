import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, type ActorRequest } from '../security/auth.guard.js';
import { ApiService } from '../services/api.service.js';
import { BookingService } from '../services/booking.service.js';

@Controller('api/v1')
@UseGuards(AuthGuard)
export class ApiController {
  constructor(private readonly api: ApiService, private readonly booking: BookingService) {}

  @Get('dashboard/overview')
  dashboardOverview(@Req() req: ActorRequest) { return this.api.dashboardOverview(req.actor); }

  @Get('patients')
  patients(@Req() req: ActorRequest, @Query() query: Record<string, unknown>) { return this.api.patients(req.actor, query); }

  @Post('patients')
  patientsCreate(@Req() req: ActorRequest, @Body() body: unknown) { return this.api.createPatient(req.actor, body); }

  @Get('doctors')
  doctors(@Req() req: ActorRequest, @Query() query: Record<string, unknown>) { return this.api.doctors(req.actor, query); }

  @Get('appointment-types')
  appointmentTypes(@Req() req: ActorRequest) { return this.api.appointmentTypes(req.actor); }

  @Get('doctor-schedules')
  schedules(@Req() req: ActorRequest, @Query() query: Record<string, unknown>) { return this.api.schedules(req.actor, query); }

  @Post('doctor-schedules')
  schedulesCreate(@Req() req: ActorRequest, @Body() body: unknown) { return this.api.createSchedule(req.actor, body); }

  @Patch('doctor-schedules/:scheduleId')
  schedulesUpdate(@Req() req: ActorRequest, @Param('scheduleId') id: string, @Body() body: unknown) { return this.api.updateSchedule(req.actor, id, body); }

  @Post('doctor-schedules/:scheduleId/breaks')
  breaksCreate(@Req() req: ActorRequest, @Param('scheduleId') id: string, @Body() body: unknown) { return this.api.addBreak(req.actor, id, body); }

  @Delete('doctor-schedules/:scheduleId/breaks/:breakId')
  @HttpCode(HttpStatus.NO_CONTENT)
  breaksDelete(@Req() req: ActorRequest, @Param('scheduleId') scheduleId: string, @Param('breakId') breakId: string) { return this.api.removeBreak(req.actor, scheduleId, breakId); }

  @Get('availability')
  availability(@Req() req: ActorRequest, @Query() query: Record<string, unknown>) { return this.booking.availability(req.actor, query); }

  @Get('appointments')
  appointments(@Req() req: ActorRequest, @Query() query: Record<string, unknown>) { return this.api.appointments(req.actor, query); }

  @Get('appointments/:appointmentId')
  appointment(@Req() req: ActorRequest, @Param('appointmentId') id: string) { return this.api.appointment(req.actor, id); }

  @Post('appointments')
  appointmentsCreate(@Req() req: ActorRequest, @Body() body: unknown) { return this.booking.book(req.actor, body); }

  @Post('appointments/:appointmentId/cancel')
  @HttpCode(HttpStatus.OK)
  appointmentsCancel(@Req() req: ActorRequest, @Param('appointmentId') id: string, @Body() body: unknown) { return this.booking.cancel(req.actor, id, body); }

  @Post('appointments/:appointmentId/complete')
  @HttpCode(HttpStatus.OK)
  appointmentsComplete(@Req() req: ActorRequest, @Param('appointmentId') id: string) { return this.booking.complete(req.actor, id); }
}
