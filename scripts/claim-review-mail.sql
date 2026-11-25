-- Reserve up to ten pending notifications. A failed delivery becomes eligible again in 15 minutes.
WITH candidates AS MATERIALIZED (
  SELECT u.id,u.username,u.division,
         replace(gen_random_uuid()::text || gen_random_uuid()::text,'-','') AS token,
         floor(extract(epoch FROM now())*1000)::bigint AS now_ms
  FROM baynet.users u
  LEFT JOIN baynet.settings m ON m.key='review-mail:' || u.id
  WHERE u.role='pending' AND u.division IN ('Direktur','Manajer','Supervisor')
    AND (m.key IS NULL OR m.value::bigint <= extract(epoch FROM now())*1000)
  ORDER BY u.id LIMIT 10
), reserved AS (
  INSERT INTO baynet.settings(key,value)
    SELECT 'review-mail:' || id,(now_ms+900000)::text FROM candidates
  ON CONFLICT(key) DO UPDATE SET value=excluded.value
    WHERE baynet.settings.value::bigint <= extract(epoch FROM now())*1000
  RETURNING key
), issued AS (
  INSERT INTO baynet.settings(key,value)
    SELECT 'review:' || encode(sha256(convert_to(c.token,'UTF8')),'hex'),
           json_build_object('id',c.id,'expires',c.now_ms+604800000)::text
    FROM candidates c JOIN reserved r ON r.key='review-mail:' || c.id
  RETURNING key
)
SELECT c.id,c.username,c.division,c.token FROM candidates c
JOIN issued i ON i.key='review:' || encode(sha256(convert_to(c.token,'UTF8')),'hex');
