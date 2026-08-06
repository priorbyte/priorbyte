import Link from 'next/link';
import type { Metadata } from 'next';
import type {
  ChatConversationRow,
  ChatSharingConsentRow,
  CourseRow,
  ProfileRow,
} from '@priorbyte/shared/database';
import { requireProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Faculty · Roster' };

const LEVEL_LABEL: Record<ChatSharingConsentRow['level'], string> = {
  none: 'Not sharing',
  selected: 'Sharing selected chats',
  full: 'Sharing all chats',
};

export default async function FacultyCoursePage({ params }: { params: { courseId: string } }) {
  await requireProfile();
  const supabase = createClient();
  const courseId = params.courseId;

  const [{ data: course }, { data: enrollments }, { data: consents }, { data: conversations }] =
    await Promise.all([
      supabase.from('courses').select('*').eq('id', courseId).maybeSingle<CourseRow>(),
      supabase.from('course_enrollments').select('user_id').eq('course_id', courseId),
      supabase
        .from('chat_sharing_consent')
        .select('*')
        .eq('course_id', courseId)
        .returns<ChatSharingConsentRow[]>(),
      supabase
        .from('chat_conversations')
        .select('*')
        .eq('course_id', courseId)
        .order('updated_at', { ascending: false })
        .returns<ChatConversationRow[]>(),
    ]);

  const studentIds = (enrollments ?? []).map((e) => e.user_id);
  const { data: students } =
    studentIds.length > 0
      ? await supabase
          .from('profiles')
          .select('id, email, display_name, username')
          .in('id', studentIds)
          .returns<Pick<ProfileRow, 'id' | 'email' | 'display_name' | 'username'>[]>()
      : { data: [] };

  const studentById = new Map((students ?? []).map((s) => [s.id, s]));
  const consentByUser = new Map((consents ?? []).map((c) => [c.user_id, c]));
  const conversationsByUser = new Map<string, ChatConversationRow[]>();
  for (const c of conversations ?? []) {
    const list = conversationsByUser.get(c.user_id) ?? [];
    list.push(c);
    conversationsByUser.set(c.user_id, list);
  }

  return (
    <div className="space-y-8">
      <div>
        <Link href="/faculty" className="font-mono text-xs text-cyan hover:underline">
          ← All courses
        </Link>
        <p className="pb-label mt-3">{course?.code ?? 'Course'}</p>
        <h1 className="mt-2 text-4xl">{course?.title ?? 'Roster'}</h1>
      </div>

      <section className="space-y-3">
        <h2 className="pb-label">Roster ({studentIds.length})</h2>
        {studentIds.length === 0 ? (
          <p className="text-sm text-muted">No students enrolled yet.</p>
        ) : (
          <div className="space-y-3">
            {studentIds.map((id) => {
              const student = studentById.get(id);
              const consent = consentByUser.get(id);
              const level = consent?.level ?? 'none';
              const sharedConversations = conversationsByUser.get(id) ?? [];
              return (
                <div key={id} className="pb-panel">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm text-white">
                        {student?.display_name ?? student?.username ?? 'Student'}
                      </p>
                      <p className="font-mono text-xs text-muted">{student?.email ?? id}</p>
                    </div>
                    <span
                      className={`shrink-0 font-mono text-xs ${
                        level === 'none' ? 'text-muted' : 'text-teal'
                      }`}
                    >
                      {LEVEL_LABEL[level]}
                    </span>
                  </div>
                  {sharedConversations.length > 0 && (
                    <ul className="mt-3 space-y-1 border-t border-line pt-3">
                      {sharedConversations.map((c) => (
                        <li key={c.id}>
                          <Link
                            href={`/faculty/${courseId}/conversations/${c.id}`}
                            className="text-sm text-cyan hover:underline"
                          >
                            {c.title ?? 'Untitled conversation'}
                          </Link>
                          <span className="ml-2 font-mono text-xs text-muted">
                            {new Date(c.updated_at).toLocaleDateString()}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
