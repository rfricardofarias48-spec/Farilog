---
name: feedback-push-automatico
description: Sempre fazer git push automaticamente após cada commit, sem esperar o usuário pedir
metadata:
  type: feedback
---

Sempre fazer `git push origin main` automaticamente após cada commit, sem esperar o usuário pedir.

**Why:** O usuário pediu explicitamente que o push seja feito automaticamente após commits.

**How to apply:** Sempre que criar um commit, encadear imediatamente com `git push origin main` na mesma sequência de comandos.
