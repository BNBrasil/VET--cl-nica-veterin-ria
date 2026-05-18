# Database Skills

## Banco de dados preferencial
- SQLite para aplicações desktop e protótipos (via sql.js ou better-sqlite3)
- Use migrations versionadas para controlar o schema
- Sempre use prepared statements / parâmetros para evitar SQL injection

## Convenções
- Tabelas em snake_case plural (ex: users, project_tasks)
- Chaves primárias: INTEGER PRIMARY KEY AUTOINCREMENT
- Timestamps: created_at, updated_at em formato ISO 8601
- Foreign keys: declare REFERENCES com ON DELETE CASCADE quando apropriado

## Boas práticas
- Normalize o schema (3NF) salvo por razões claras de performance
- Indexe colunas usadas em WHERE e JOIN frequentes
- Use transações para operações em lote
- Faça backup antes de migrations destrutivas
