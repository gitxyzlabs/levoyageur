-- Quick check if favorites and want_to_go tables exist

SELECT 
  'favorites' as table_name,
  COUNT(*) as row_count
FROM favorites
UNION ALL
SELECT 
  'want_to_go' as table_name,
  COUNT(*) as row_count
FROM want_to_go;
