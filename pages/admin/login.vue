<script setup lang="ts">
definePageMeta({ layout: 'admin' })
useHead({ title: 'Connexion · Admin Balise' })

const route = useRoute()
const { signIn } = useAdminAuth()

const email = ref('')
const password = ref('')
const loading = ref(false)
const error = ref<string | null>(null)

async function submit() {
  error.value = null
  loading.value = true
  try {
    await signIn(email.value, password.value)
    const redirect = typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/admin')
      ? route.query.redirect
      : '/admin'
    await navigateTo(redirect)
  }
  catch (e) {
    error.value = friendlyError(e)
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="login">
    <p class="login__kicker">Admin</p>
    <h1 class="login__title">Connexion organisateur</h1>

    <form class="login__form" @submit.prevent="submit">
      <div class="field">
        <label class="field__label" for="email">Email</label>
        <input id="email" v-model="email" class="input" type="email" autocomplete="username" required>
      </div>
      <div class="field">
        <label class="field__label" for="password">Mot de passe</label>
        <input id="password" v-model="password" class="input" type="password" autocomplete="current-password" required>
      </div>

      <p v-if="error" class="form-error" role="alert">{{ error }}</p>

      <AppButton type="submit" variant="dark" size="lg" block :loading="loading">
        {{ loading ? 'Connexion…' : 'Se connecter' }}
      </AppButton>
    </form>
  </main>
</template>

<style scoped>
.login {
  max-width: 420px;
  margin: 0 auto;
  padding: 12vh var(--space-5) var(--space-8);
}

.login__kicker {
  color: var(--color-text-muted);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.login__title {
  margin-top: var(--space-1);
  font-family: var(--font-body);
  font-size: 1.75rem;
  font-weight: 700;
}

.login__form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  margin-top: var(--space-6);
}
</style>
