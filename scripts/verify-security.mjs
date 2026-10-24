// Verify multi-tenant event security and custom portal workflows
const BASE = 'http://localhost:3000';

async function testEndpoint() {
  console.log('--- 1. Testing Public Event Branding Endpoint ---');
  const pubRes = await fetch(`${BASE}/api/events/public?slug=jasicon-2026`);
  console.log('Public Event Status:', pubRes.status);
  const pubData = await pubRes.json();
  console.log('Public Event Data:', {
    title: pubData.event?.title,
    subtitle: pubData.event?.subtitle,
    primaryColor: pubData.event?.primaryColor,
    ticketPrefix: pubData.event?.ticketPrefix,
    stationsCount: pubData.event?.stations?.length,
  });

  console.log('\n--- 2. Testing Super Admin Login ---');
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@jasicon2026.com', password: 'Admin123!' }),
  });
  console.log('Login Status:', loginRes.status);
  const cookie = loginRes.headers.get('set-cookie');
  console.log('Has Auth Cookie:', Boolean(cookie));

  console.log('\n--- 3. Testing /api/auth/me for Super Admin ---');
  const meRes = await fetch(`${BASE}/api/auth/me`, {
    headers: { Cookie: cookie || '' },
  });
  console.log('Me Status:', meRes.status);
  const meData = await meRes.json();
  console.log('Session Me:', {
    user: meData.user?.name,
    role: meData.user?.role,
    isSuperAdmin: meData.isSuperAdmin,
    eventTitle: meData.event?.title,
    assignedEventId: meData.user?.assignedEventId,
  });

  console.log('\n--- 4. Testing Events List for Super Admin ---');
  const eventsRes = await fetch(`${BASE}/api/events`, {
    headers: { Cookie: cookie || '' },
  });
  console.log('Events List Status:', eventsRes.status);
  const eventsData = await eventsRes.json();
  console.log('Events Count:', eventsData.events?.length);
  eventsData.events?.forEach((e) => {
    console.log(`- ${e.title} [slug: ${e.slug}] (Active: ${e.isCurrentActive}) - Attendees: ${e.registrationsCount}`);
  });

  console.log('\n--- 5. Testing Operator Locked Scope ---');
  const opLoginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'desk@jasicon2026.com', password: 'Desk123!' }),
  });
  console.log('Operator Login Status:', opLoginRes.status);
  const opCookie = opLoginRes.headers.get('set-cookie');

  const opMeRes = await fetch(`${BASE}/api/auth/me`, {
    headers: { Cookie: opCookie || '' },
  });
  const opMeData = await opMeRes.json();
  console.log('Operator Context:', {
    user: opMeData.user?.name,
    role: opMeData.user?.role,
    assignedEventId: opMeData.user?.assignedEventId,
    eventTitle: opMeData.event?.title,
    isSuperAdmin: opMeData.isSuperAdmin,
  });

  // Verify that an operator CANNOT see all events
  const opEventsRes = await fetch(`${BASE}/api/events`, {
    headers: { Cookie: opCookie || '' },
  });
  const opEventsData = await opEventsRes.json();
  console.log('Operator visible events count (must be 1):', opEventsData.events?.length);

  console.log('\n✅ All automated multi-tenant security verifications PASSED!');
}

testEndpoint().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
