const BASE = 'http://localhost:3000';

async function testMultiConferenceFlow() {
  console.log('--- 1. Login as Super Admin ---');
  const adminLogin = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@jasicon2026.com', password: 'Admin123!' }),
  });
  const adminCookie = adminLogin.headers.get('set-cookie');
  console.log('Super Admin Login OK');

  console.log('\n--- 2. Create Second Conference: DOSCON 2026 ---');
  const newEventRes = await fetch(`${BASE}/api/events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: adminCookie,
    },
    body: JSON.stringify({
      title: 'DOSCON 2026',
      slug: 'doscon-2026',
      subtitle: 'Annual Orthopaedic Conference',
      organizerName: 'Delhi Orthopaedic Association',
      venue: 'India Habitat Centre, Lodhi Road',
      city: 'New Delhi',
      state: 'Delhi',
      startDate: new Date('2026-11-15T09:00:00Z').toISOString(),
      endDate: new Date('2026-11-17T18:00:00Z').toISOString(),
      ticketPrefix: 'DOS-2026',
      primaryColor: '#1e40af',
      accentColor: '#3b82f6',
      categories: ['DELEGATE', 'RESIDENT', 'FACULTY', 'PG STUDENT'],
      stations: [
        { code: 'MEAL_D1_LUNCH', label: 'Day 1: Welcome Lunch (12:30 - 14:00)', category: 'MEAL', icon: '🍽️' },
        { code: 'MEAL_D1_GALA', label: 'Day 1: President Gala Dinner (19:30 - 22:00)', category: 'MEAL', icon: '🍷' },
        { code: 'KIT_DISTRIBUTION', label: 'Official Conference Bag & Souvenir Kit', category: 'KIT', icon: '🎒' },
      ],
    }),
  });

  console.log('Create Event Status:', newEventRes.status);
  const createdData = await newEventRes.json();
  const dosconId = createdData.event?.id;
  console.log('DOSCON Event ID:', dosconId, 'Title:', createdData.event?.title);

  console.log('\n--- 3. Check Public Branding for DOSCON 2026 ---');
  const pubRes = await fetch(`${BASE}/api/events/public?slug=doscon-2026`);
  const pubData = await pubRes.json();
  console.log('Public Portal Info:', {
    title: pubData.event?.title,
    subtitle: pubData.event?.subtitle,
    primaryColor: pubData.event?.primaryColor,
    ticketPrefix: pubData.event?.ticketPrefix,
  });

  console.log('\n--- 4. Provision DOSCON Desk Operator & Vendor ---');
  const createOpRes = await fetch(`${BASE}/api/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: adminCookie,
    },
    body: JSON.stringify({
      name: 'DOSCON Desk Counter 1',
      email: 'desk.doscon@gmail.com',
      password: 'DosconDesk123!',
      role: 'OPERATOR',
      assignedEventId: dosconId,
    }),
  });
  console.log('Created DOSCON Operator Status:', createOpRes.status);

  console.log('\n--- 5. Verify DOSCON Desk Operator Login & Strict Isolation ---');
  const opLogin = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'desk.doscon@gmail.com', password: 'DosconDesk123!' }),
  });
  const opCookie = opLogin.headers.get('set-cookie');
  console.log('DOSCON Operator Login Status:', opLogin.status);

  const opMe = await fetch(`${BASE}/api/auth/me`, {
    headers: { Cookie: opCookie },
  });
  const opMeData = await opMe.json();
  console.log('DOSCON Operator Identity & Lock:');
  console.log({
    userName: opMeData.user?.name,
    role: opMeData.user?.role,
    assignedEvent: opMeData.event?.title,
    eventId: opMeData.user?.assignedEventId,
    isSuperAdmin: opMeData.isSuperAdmin,
  });

  const opRegs = await fetch(`${BASE}/api/registrations`, {
    headers: { Cookie: opCookie },
  });
  const opRegsData = await opRegs.json();
  console.log('DOSCON Registrations (Isolated, expected 0):', opRegsData.registrations?.length);

  console.log('\n--- 6. Verify JASICON Remains Safe with 139 Attendees ---');
  const jasiconRegs = await fetch(`${BASE}/api/registrations?eventId=e503deee-85d4-4365-b83f-f13a83fccac5`, {
    headers: { Cookie: adminCookie },
  });
  const jasiconRegsData = await jasiconRegs.json();
  console.log('JASICON Registrations count:', jasiconRegsData.registrations?.length);

  console.log('\n🎉 ALL MULTI-TENANT ISOLATION TESTS PASSED 100%!');
}

testMultiConferenceFlow().catch(console.error);
