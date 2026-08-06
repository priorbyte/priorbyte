import type { Metadata } from 'next';
import type { KnowledgeGraphEdgeRow, KnowledgeGraphRow } from '@priorbyte/shared/database';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { AddTopicForm } from './add-topic-form';
import { TopicRow } from './topic-row';

export const metadata: Metadata = { title: 'Admin · Knowledge Graph' };

export default async function AdminKnowledgeGraphPage() {
  await requireAdmin();
  const supabase = createClient();

  const [{ data: topics }, { data: edges }] = await Promise.all([
    supabase.from('knowledge_graph').select('*').order('subject').returns<KnowledgeGraphRow[]>(),
    supabase.from('knowledge_graph_edges').select('*').returns<KnowledgeGraphEdgeRow[]>(),
  ]);

  const allTopics = topics ?? [];
  const prereqsByTopic = new Map<string, string[]>();
  for (const edge of edges ?? []) {
    const list = prereqsByTopic.get(edge.topic_id) ?? [];
    list.push(edge.prerequisite_id);
    prereqsByTopic.set(edge.topic_id, list);
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="pb-label">Admin</p>
        <h1 className="mt-2 text-4xl">Knowledge Graph</h1>
        <p className="mt-2 text-sm text-muted">
          {allTopics.length} topics — this is what the Error Oracle predicts on.
        </p>
      </div>

      <AddTopicForm />

      <div className="space-y-4">
        {allTopics.map((topic) => (
          <TopicRow
            key={topic.id}
            topic={topic}
            allTopics={allTopics}
            prerequisiteIds={prereqsByTopic.get(topic.id) ?? []}
          />
        ))}
      </div>
    </div>
  );
}
