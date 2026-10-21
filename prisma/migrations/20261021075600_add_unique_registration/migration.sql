-- CreateIndex
CREATE UNIQUE INDEX "event_registrations_personId_eventId_key" ON "event_registrations"("personId", "eventId");
