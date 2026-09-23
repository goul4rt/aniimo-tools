#!/bin/sh
# Registra o comando /aniimo no Discord. Rodar uma vez (e de novo se o comando mudar).
# Uso: DISCORD_APP_ID=... DISCORD_BOT_TOKEN=... sh bot/registrar.sh
set -eu
curl -sf -X PUT "https://discord.com/api/v10/applications/$DISCORD_APP_ID/commands" \
  -H "Authorization: Bot $DISCORD_BOT_TOKEN" -H "Content-Type: application/json" \
  -d '[{"name":"aniimo","description":"Ficha de um Aniimo: stats, elementos, formas e onde encontrar","integration_types":[0,1],"contexts":[0,1,2],
       "options":[{"type":3,"name":"nome","description":"Nome em português ou inglês","required":true,"autocomplete":true}]}]' >/dev/null
echo "ok: /aniimo registrado"
