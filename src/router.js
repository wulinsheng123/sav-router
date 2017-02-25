import {connectRouter} from './container.js'

export class Router {
  constructor (opts) {
    this.opts = {...opts}
    this.providers = {}
    this.modules = []
    this.plugins = []
    this.moduleMaps = {}
    this._container = null
    if (!this.opts.noContainer) {
      this.use(connectRouter)
    }
  }
  use (fn) {
    this.plugins.push(fn(this))
  }
  provider (providers) {
    this.providers = {...this.providers, ...providers}
  }
  declare (modules) {
    if (!Array.isArray(modules)) {
      modules = [modules]
    }
    this.modules = this.modules.concat(modules)
    walkPlugins(this, modules)
  }
  config (name) {
    return this.opts[name]
  }
  set container (container) {
    this._container = container
  }
  get container () {
    return this._container
  }
  route () {
    let self = this
    return async (ctx, next) => {
      await self.dispatch(ctx, next)
    }
  }
  async dispatch (ctx, next) {
    let {path, method} = ctx
    let route = this.container.matchRoute(path, method)
    if (route) {
      let action = this.moduleMaps[route.moduleName].actions[route.actionName]
      route.action = action.action
      ctx.route = route
      ctx.params = route.params
      await applyMiddlewares(ctx, action.middlewares)
    } else {
      await next()
    }
  }
}

function createMiddlewares (router, module) {
  const providers = router.providers
  for (let actionName in module.actions) {
    let action = module.actions[actionName]
    let middlewares = []
    for (let config of action.options) {
      let [name, ...args] = config
      if (providers[name]) {
        let method = providers[name]({router, module, action, name, args})
        if (typeof method === 'function') {
          middlewares.push({name, method})
        }
      }
    }
    action.middlewares = middlewares
  }
}

function walkPlugins (router, modules) {
  for (let module of modules) {
    router.moduleMaps[module.name] = module
    for (let plugin of router.plugins) {
      plugin(router, module)
    }
    createMiddlewares(router, module)
  }
}

async function applyMiddlewares (ctx, middlewares) {
  for (let middleware of middlewares) {
    await middleware.method(ctx)
  }
}
