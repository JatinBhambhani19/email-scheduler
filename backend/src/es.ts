import { Client } from '@elastic/elasticsearch';
import { cfg } from './config';
const es = new Client({ node: cfg.es });
export const indexEmail = (e: Record<string, any>) =>
  es.index({ index: 'emails', id: String(e.id), document: e }).catch(err => console.error('ES index failed:', err.message));
export async function searchEmails(userId: string, q: string) {
  const r = await es.search({ index: 'emails', size: 100, query: { bool: {
    filter: [{ term: { 'user_id.keyword': userId } }],
    must: [{ multi_match: { query: q, fields: ['recipient', 'subject', 'body'] } }] } } });
  return r.hits.hits.map(h => h._source);
}
