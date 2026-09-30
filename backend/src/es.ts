import { Client } from '@elastic/elasticsearch';
import { cfg } from './config';
import { db } from './db';

const esUrl = process.env.ES_URL?.trim();

const es = esUrl
  ? new Client({ node: esUrl })
  : null;

export const indexEmail = async (e: Record<string, any>) => {
  if (!es) return;

  try {
    await es.index({
      index: 'emails',
      id: String(e.id),
      document: e
    });
  } catch (err: any) {
    console.error(
      'ES index failed:',
      err?.message || 'Unknown Elasticsearch error'
    );
  }
};

export async function searchEmails(
  userId: string,
  q: string
) {
  // Use Elasticsearch if configured
  if (es) {
    try {
      const r = await es.search({
        index: 'emails',
        size: 100,
        query: {
          bool: {
            filter: [
              {
                term: {
                  'user_id.keyword': userId
                }
              }
            ],
            must: [
              {
                multi_match: {
                  query: q,
                  fields: [
                    'recipient',
                    'subject',
                    'body'
                  ]
                }
              }
            ]
          }
        }
      });

      return r.hits.hits.map(
        h => h._source
      );
    } catch (err: any) {
      console.error(
        'ES search failed:',
        err?.message || 'Unknown Elasticsearch error'
      );
    }
  }

  // PostgreSQL fallback when Elasticsearch is not available
  const search = `%${q}%`;

  const { rows } = await db.query(
    `SELECT
       id,
       user_id,
       recipient,
       subject,
       body,
       scheduled_at,
       sent_at,
       status,
       hourly_limit,
       error
     FROM emails
     WHERE user_id = $1
       AND (
         recipient ILIKE $2
         OR subject ILIKE $2
         OR body ILIKE $2
       )
     ORDER BY scheduled_at DESC
     LIMIT 100`,
    [userId, search]
  );

  return rows;
}