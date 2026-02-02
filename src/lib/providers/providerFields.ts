export type ScheduleTypeKind = 'fixed-schedules' | 'in-advance-book' | 'real-time-book';

export type AdvanceNotice = '1h' | '1d' | '2d' | '3d' | '1w';

export type BookingMethod = 'none' | 'call' | 'app';

export type FareType = 'fixed' | 'distance-based' | 'free';
export type FarePayment = 'cash' | 'ticket';

export type EligibilityType = 'Disabled' | 'Senior' | 'Resident' | 'Veteran';
export type EligibilityProof = 'ada-approved' | 'id-certified';

export type ProviderType =
  | 'ADA Paratransit'
  | 'Fixed Route'
  | 'Non-ADA Paratransit'
  | 'Volunteer Driver or TNC'
  | 'Volunteer Driver or TNC Programs';

export type RoutingType = '' | 'fixed-routes' | 'curb-to-curb' | 'door-to-door';

export interface ScheduleType {
  type: ScheduleTypeKind;
  advance_notice?: string;
}

export interface Booking {
  method: string;
  details?: string;
}

export interface Fare {
  type: string;
  cost?: string;
  payment?: string;
}

export interface EligibilityRequirement {
  type: string;
  proof?: string;
}

export interface Contact {
  name?: string;
  email?: string;
}

export const PROVIDER_TYPE_OPTIONS: ReadonlyArray<{ value: ProviderType; label: string }> = [
  { value: 'ADA Paratransit', label: 'ADA Paratransit' },
  { value: 'Non-ADA Paratransit', label: 'Non-ADA Paratransit' },
  { value: 'Fixed Route', label: 'Fixed Route' },
  { value: 'Volunteer Driver or TNC', label: 'Volunteer Driver or TNC' },
  { value: 'Volunteer Driver or TNC Programs', label: 'Volunteer Driver or TNC Programs' },
];

export const ROUTING_TYPE_OPTIONS: ReadonlyArray<{ value: RoutingType; label: string }> = [
  { value: '', label: '—' },
  { value: 'fixed-routes', label: 'Fixed routes' },
  { value: 'curb-to-curb', label: 'Curb-to-curb' },
  { value: 'door-to-door', label: 'Door-to-door' },
];

export const SCHEDULE_TYPE_OPTIONS: ReadonlyArray<{ value: ScheduleTypeKind; label: string }> = [
  { value: 'fixed-schedules', label: 'Fixed schedules' },
  { value: 'in-advance-book', label: 'Book in advance' },
  { value: 'real-time-book', label: 'Book in real time' },
];

export const ADVANCE_NOTICE_OPTIONS: ReadonlyArray<{ value: AdvanceNotice; label: string }> = [
  { value: '1h', label: '1 hour' },
  { value: '1d', label: '1 day' },
  { value: '2d', label: '2 days' },
  { value: '3d', label: '3 days' },
  { value: '1w', label: '1 week' },
];

export const BOOKING_METHOD_OPTIONS: ReadonlyArray<{ value: BookingMethod; label: string }> = [
  { value: 'none', label: 'No booking needed' },
  { value: 'call', label: 'Call' },
  { value: 'app', label: 'App' },
];

export const FARE_TYPE_OPTIONS: ReadonlyArray<{ value: FareType; label: string }> = [
  { value: 'fixed', label: 'Fixed' },
  { value: 'distance-based', label: 'Distance-based' },
  { value: 'free', label: 'Free' },
];

export const FARE_PAYMENT_OPTIONS: ReadonlyArray<{ value: FarePayment; label: string }> = [
  { value: 'cash', label: 'Cash' },
  { value: 'ticket', label: 'Ticket' },
];

export const ELIGIBILITY_TYPE_OPTIONS: ReadonlyArray<{ value: EligibilityType; label: string }> = [
  { value: 'Senior', label: 'Senior' },
  { value: 'Disabled', label: 'Disabled' },
  { value: 'Veteran', label: 'Veteran' },
  { value: 'Resident', label: 'Resident' },
];

export const ELIGIBILITY_PROOF_OPTIONS: ReadonlyArray<{ value: EligibilityProof; label: string }> = [
  { value: 'id-certified', label: 'ID certified' },
  { value: 'ada-approved', label: 'ADA approved' },
];

export function tryParseJson(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  const first = trimmed[0];
  if (first !== '{' && first !== '[') return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

export function formatScheduleType(value: unknown): string | null {
  const parsed = tryParseJson(value);
  if (!parsed) return null;

  if (typeof parsed === 'string') {
    const trimmed = parsed.trim();
    return trimmed ? trimmed : null;
  }

  if (typeof parsed !== 'object' || Array.isArray(parsed)) return null;

  const type = typeof (parsed as Record<string, unknown>).type === 'string'
    ? ((parsed as Record<string, unknown>).type as string)
    : null;
  const advance = typeof (parsed as Record<string, unknown>).advance_notice === 'string'
    ? ((parsed as Record<string, unknown>).advance_notice as string)
    : null;

  if (!type) return null;

  if (type === 'in-advance-book') {
    return advance ? `Book in advance (${advance})` : 'Book in advance';
  }
  if (type === 'real-time-book') return 'Book in real time';
  if (type === 'fixed-schedules') return 'Fixed schedules';
  return type;
}

export function formatBooking(value: unknown): string | null {
  const parsed = tryParseJson(value);
  if (!parsed) return null;

  if (typeof parsed === 'string') {
    const trimmed = parsed.trim();
    return trimmed ? trimmed : null;
  }

  if (typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const obj = parsed as Record<string, unknown>;
  const method = typeof obj.method === 'string' ? obj.method : '';
  const details = typeof obj.details === 'string' ? obj.details.trim() : '';

  if (!method) return null;
  if (method === 'none') return 'No booking needed';
  if (method === 'call') return details ? `Call: ${details}` : 'Call';
  if (method === 'app') return details ? `App: ${details}` : 'App';
  return details ? `${method}: ${details}` : method;
}

export function formatFare(value: unknown): string | null {
  const parsed = tryParseJson(value);
  if (!parsed) return null;

  if (typeof parsed === 'string') {
    const trimmed = parsed.trim();
    return trimmed ? trimmed : null;
  }

  if (typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const obj = parsed as Record<string, unknown>;
  const type = typeof obj.type === 'string' ? obj.type : '';
  const cost = typeof obj.cost === 'string' ? obj.cost.trim() : '';
  const payment = typeof obj.payment === 'string' ? obj.payment.trim() : '';

  if (!type) return null;
  if (type === 'free') return 'Free';
  if (type === 'distance-based') return 'Distance-based';
  if (type === 'fixed') {
    const parts = ['Fixed'];
    if (cost) parts.push(cost);
    if (payment) parts.push(payment);
    return parts.join(' · ');
  }
  const parts = [type];
  if (cost) parts.push(cost);
  if (payment) parts.push(payment);
  return parts.join(' · ');
}

export function formatContacts(value: unknown): string | null {
  const parsed = tryParseJson(value);
  if (!parsed) return null;

  if (typeof parsed === 'string') {
    const trimmed = parsed.trim();
    return trimmed ? trimmed : null;
  }

  if (!Array.isArray(parsed)) return null;

  const lines = parsed
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const name = typeof (entry as Record<string, unknown>).name === 'string'
        ? ((entry as Record<string, unknown>).name as string).trim()
        : '';
      const email = typeof (entry as Record<string, unknown>).email === 'string'
        ? ((entry as Record<string, unknown>).email as string).trim()
        : '';
      if (name && email) return `${name} <${email}>`;
      if (email) return email;
      if (name) return name;
      return null;
    })
    .filter(Boolean) as string[];

  return lines.length ? lines.join('\n') : null;
}

export function formatEligibilityReqs(value: unknown): string | null {
  const parsed = tryParseJson(value);
  if (!parsed) return null;

  if (typeof parsed === 'string') {
    const trimmed = parsed.trim();
    return trimmed ? trimmed : null;
  }

  let arr: unknown[] | null = null;
  if (Array.isArray(parsed)) {
    arr = parsed;
  } else if (parsed && typeof parsed === 'object' && Array.isArray((parsed as Record<string, unknown>).eligibility_reqs)) {
    arr = (parsed as Record<string, unknown>).eligibility_reqs as unknown[];
  }

  if (!arr) return null;

  const lines = arr
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return String(entry);
      const type = typeof (entry as Record<string, unknown>).type === 'string'
        ? ((entry as Record<string, unknown>).type as string).trim()
        : '';
      const proof = typeof (entry as Record<string, unknown>).proof === 'string'
        ? ((entry as Record<string, unknown>).proof as string).trim()
        : '';
      if (type && proof) return `${type} (${proof})`;
      if (type) return type;
      return null;
    })
    .filter(Boolean) as string[];

  return lines.length ? lines.join('\n') : null;
}

export function formatServiceZone(value: unknown): string | null {
  const parsed = tryParseJson(value);
  if (!parsed) return null;

  if (typeof parsed === 'string') {
    const trimmed = parsed.trim();
    return trimmed ? trimmed : null;
  }

  if (typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const obj = parsed as Record<string, unknown>;
  const type = typeof obj.type === 'string' ? obj.type : null;
  const features = obj.features;
  const count = Array.isArray(features) ? features.length : null;
  if (type === 'FeatureCollection' && typeof count === 'number') {
    return `FeatureCollection (${count} feature${count === 1 ? '' : 's'})`;
  }
  if (type) return type;
  return 'GeoJSON set';
}
