/** Protège toutes les pages /admin, sauf la page de connexion. */
export default defineNuxtRouteMiddleware(async (to) => {
  if (!to.path.startsWith('/admin')) return

  const { state, ensureReady } = useAdminAuth()
  await ensureReady()

  const isLogin = to.path === '/admin/login'
  if (!state.value.isAdmin && !isLogin) {
    return navigateTo({ path: '/admin/login', query: { redirect: to.fullPath } })
  }
  if (state.value.isAdmin && isLogin) {
    return navigateTo('/admin')
  }
})
