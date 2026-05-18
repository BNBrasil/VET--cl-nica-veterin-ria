# Testing Skills

## Stack de testes preferencial
- Unit tests: Jest com TypeScript (ts-jest)
- Integration tests: Supertest para APIs HTTP
- E2E: Playwright para aplicações web/desktop

## Convenções
- Arquivos de teste ao lado do código: *.test.ts ou *.spec.ts
- Nomeie describes e its em português: "deve retornar erro quando email inválido"
- Use describe() para agrupar testes relacionados
- Use beforeEach/afterEach para setup e teardown

## Boas práticas
- Teste comportamentos observáveis, não detalhes de implementação
- Use mocks apenas para dependências externas (APIs, filesystem, banco de dados)
- Mantenha cobertura mínima de 80% em código crítico de negócio
- Cada teste deve ser independente e reproduzível (sem dependência de ordem)
