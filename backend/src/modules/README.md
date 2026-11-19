# Modulos de negocio previstos

Crear cada modulo con sus controller, service, DTO, entities y pruebas segun se implemente.
Estos modulos aun no estan implementados:

- auth, users, roles, profiles
- artists, songs, releases
- player, listening-history, playlists, favorites
- recommendations, dj-ai
- follows, posts, comments, reactions
- groups, group-members
- chats, messages
- events, ticket-categories, orders, tickets, payments, qr-validation
- notifications, analytics, moderation

TypeORM conecta PostgreSQL con synchronize=false. Los cambios de esquema deben realizarse mediante migraciones revisadas.
