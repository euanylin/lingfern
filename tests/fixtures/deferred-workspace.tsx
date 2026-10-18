import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import MaterialWorkspace from '../../src/app/MaterialWorkspace';
import { organizePractice } from '../../src/core/practiceOrganization';
import { claimSession, createSession, type Session } from '../../src/data/db';
import { lessonSchema } from '../../src/shared/content';
import '../../src/app/style.css';

export async function mountDeferredWorkspace(raw: unknown) {
  const owner = crypto.randomUUID(), created = await createSession(organizePractice(lessonSchema.parse(raw)));
  const initial = await claimSession(created.id, owner);
  function Parent() {
    const [session, setSession] = useState<Session>(initial);
    return <MaterialWorkspace session={session} owner={owner} locale="zh-Hans" profileId={session.profileId} online={true} onlineDictionary="cambridge" combinedSessions={[]}
      onSession={next => { window.setTimeout(() => setSession(next), 150); }}/>;
  }
  createRoot(document.getElementById('root')!).render(<main><header className="session-header">Focus regression</header><Parent/></main>);
}
