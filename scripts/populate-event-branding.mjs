import { PrismaClient } from '@prisma/client';

const directUrl = 'postgresql://neondb_owner:npg_q3mfvTNcuE0j@ep-autumn-union-b4utz1zp.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require';
const prisma = new PrismaClient({ datasources: { db: { url: directUrl } } });

const defaultStations = [
  { code: 'MEAL_D1_BREAKFAST', label: 'Day 1: Breakfast Buffet (08:00 - 09:30)', category: 'MEAL', icon: '☕' },
  { code: 'MEAL_D1_LUNCH', label: 'Day 1: Executive Lunch (12:30 - 14:00)', category: 'MEAL', icon: '🍽️' },
  { code: 'MEAL_D1_DINNER', label: 'Day 1: Welcome Gala Dinner (19:00 - 21:30)', category: 'MEAL', icon: '🍷' },
  { code: 'MEAL_D2_BREAKFAST', label: 'Day 2: Breakfast Buffet (08:00 - 09:30)', category: 'MEAL', icon: '☕' },
  { code: 'MEAL_D2_LUNCH', label: 'Day 2: Executive Lunch (12:30 - 14:00)', category: 'MEAL', icon: '🍽️' },
  { code: 'MEAL_D2_DINNER', label: 'Day 2: Networking Banquet (19:00 - 21:30)', category: 'MEAL', icon: '🥂' },
  { code: 'MEAL_D3_BREAKFAST', label: 'Day 3: Breakfast Buffet (08:00 - 09:30)', category: 'MEAL', icon: '☕' },
  { code: 'MEAL_D3_LUNCH', label: 'Day 3: Farewell Lunch (12:30 - 14:00)', category: 'MEAL', icon: '🍽️' },
  { code: 'MEAL_D3_DINNER', label: 'Day 3: Closing Dinner (19:00 - 21:00)', category: 'MEAL', icon: '🍲' },
  { code: 'SES_01_KEYNOTE', label: 'Session 01: Keynote & Opening Ceremony', category: 'SESSION', icon: '🎙️' },
  { code: 'SES_07_WORKSHOP_A', label: 'Session 07: Hands-On Microservices Lab', category: 'SESSION', icon: '💻' },
  { code: 'SES_08_WORKSHOP_B', label: 'Session 08: Distributed Consensus Workshop', category: 'SESSION', icon: '🔬' },
];

const defaultCategories = ['DELEGATE', 'PG STUDENT', 'FACULTY'];

const defaultWhatsapp = `Dear Dr. {{delegate_name}},

Greetings from {{conference_title}}! 🏥✨
Here are your official conference registration and digital badge details:

📋 Delegate: Dr. {{delegate_name}}
🎫 Ticket Code: {{ticket_code}}
🏛️ Conference: {{conference_subtitle}}
📍 Venue: {{venue}}
✅ Status: {{status}}

📱 View & Download your Digital Badge & QR Code online:
{{badge_url}}

Please present your QR code at the registration desk for quick check-in and access to conference meals & academic sessions.

Warm regards,  
Organizing Committee, {{conference_title}}`;

async function main() {
  const event = await prisma.event.findFirst({
    where: { isActive: true },
  });

  if (!event) {
    console.log('No active event found to populate.');
    return;
  }

  console.log(`Populating branding for event: ${event.title} (${event.id})`);

  await prisma.event.update({
    where: { id: event.id },
    data: {
      subtitle: '25th Annual State Conference of ASI',
      organizerName: 'Association of Surgeons of India (Jharkhand Chapter)',
      venue: 'Deoghar, Jharkhand',
      city: 'Deoghar',
      state: 'Jharkhand',
      ticketPrefix: 'JC-2026',
      primaryColor: '#0d625e',
      accentColor: '#10b981',
      categories: defaultCategories,
      stations: defaultStations,
      whatsappTemplate: defaultWhatsapp,
    },
  });

  // Assign non-admin users to this event
  const updatedUsers = await prisma.user.updateMany({
    where: {
      role: { not: 'ADMIN' },
      assignedEventId: null,
    },
    data: {
      assignedEventId: event.id,
    },
  });

  console.log(`Assigned ${updatedUsers.count} non-admin users to ${event.title}`);
  console.log('[SUCCESS] Event branding and user assignments initialized!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
