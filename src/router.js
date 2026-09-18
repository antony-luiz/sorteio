// Roteamento por hash (#/nomes, #/roleta, #/historico).
// No celular cada rota é uma tela cheia; no computador as três ficam lado a lado.

export const ROUTES = ['nomes', 'roleta', 'historico']
const MOBILE_QUERY = '(max-width: 899px)'

export function createRouter({ onChange, fallback }) {
  const mq = window.matchMedia(MOBILE_QUERY)
  let current = null

  const read = () => {
    const route = location.hash.replace(/^#\/?/, '')
    return ROUTES.includes(route) ? route : null
  }

  function apply() {
    document.documentElement.dataset.device = mq.matches ? 'mobile' : 'desktop'
    let route = read()
    if (!route) {
      // rota inválida ou vazia: redireciona para a tela certa
      route = fallback()
      history.replaceState(null, '', `#/${route}`)
    }
    const previous = current
    current = route
    onChange(route, previous)
  }

  window.addEventListener('hashchange', apply)
  mq.addEventListener('change', apply)

  return {
    start: apply,
    go(route) {
      if (read() === route) apply()
      else location.hash = `/${route}`
    },
    get route() {
      return current
    },
    isMobile: () => mq.matches,
  }
}
