# Part Vue3
## compile

模板编译之后，App.vue文件转换为：（template都变为render函数）
```javascript
rootComponent = {
    components: {
        Watch: { // Watch是父组件的名字
            components: {
                Child: { // Child是子组件的名字
                    inject: ["provideObj"]
                    props: ["obj"]
                    render: ƒ render(_ctx, _cache, $props, $setup, $data, $options)
                    setup: ƒ setup(props, ctx)
                    __file: "src/case/Watch/Child.vue"
                    __hmrId: "7db4b096"
                }
            },
            provide: ƒ provide(),
            render: ƒ render(_ctx, _cache, $props, $setup, $data, $options),
            setup: ƒ setup(),
            __file: "src/case/Watch/Parent.vue",
            __hmrId: "47b388c0"
        }
    },
    data: data(),
    methods: {},
    render: ƒn render(_ctx, _cache, $props, $setup, $data, $options),
    __file: "src/App.vue",
    __hmrId: "7ba5bd90"
}
```

## 为什么Composition API可以获取到currentInstance

**compositionAPI.js**
```javascript
var Plugin = {
    install: function (Vue) { return install(Vue); },
};

if (typeof window !== 'undefined' && window.Vue) {
    window.Vue.use(Plugin);
}

export default Plugin;
```
因为：compositionAPI包含了一个plugin，在引用了vue.js和compositionAPI时，会执行window.Vue.use(Plugin)，将Vue注入到compositionAPI当中。

## createApp()
**runtime-dom**
```javascript
// rendererOptions: 对dom操作的一些方法：remove、insert、parent等
function ensureRenderer() {
    return renderer || (renderer = createRenderer(rendererOptions));
}

const createApp = ((...args) => {
    const app = ensureRenderer().createApp(...args);
    if ((process.env.NODE_ENV !== 'production')) {
        injectNativeTagCheck(app);
    }
    const { mount } = app;
    app.mount = (containerOrSelector) => {
        const container = normalizeContainer(containerOrSelector);
        if (!container)
            return;
        const component = app._component;
        if (!isFunction(component) && !component.render && !component.template) {
            component.template = container.innerHTML;
        }
        // clear content before mounting
        container.innerHTML = '';
        const proxy = mount(container);
        container.removeAttribute('v-cloak');
        container.setAttribute('data-v-app', '');
        return proxy;
    };
    return app;
});
```
- 通过ensureRenderer，调用createRenderer，生成唯一一个renderer渲染器；
  - 使用ensureRenderer包装：单例模式，有renderer就返回，没有就createRenderer

**runtime-core**
```javascript
function createAppContext() {
    return {
        app: null,
        config: {
            isNativeTag: NO,
            performance: false,
            globalProperties: {},
            optionMergeStrategies: {},
            isCustomElement: NO,
            errorHandler: undefined,
            warnHandler: undefined
        },
        mixins: [],
        components: {},
        directives: {},
        provides: Object.create(null)
    };
}
function createAppAPI(render, hydrate) {
    return function createApp(rootComponent, rootProps = null) {
        const context = createAppContext();
        const installedPlugins = new Set();
        let isMounted = false;
        const app = (context.app = {
            _uid: uid++,
            _component: rootComponent,
            _props: rootProps,
            _container: null,
            _context: context,
            version,
            use(plugin, ...options) {
                if (plugin && isFunction(plugin.install)) {
                    installedPlugins.add(plugin);
                    plugin.install(app, ...options);
                }
                else if (isFunction(plugin)) {
                    installedPlugins.add(plugin);
                    plugin(app, ...options);
                }
                return app;
            },
            mixin(mixin) {
                if (__VUE_OPTIONS_API__) {
                    if (!context.mixins.includes(mixin)) {
                        context.mixins.push(mixin);
                    }
                }
                return app;
            },
            component(name, component) {
                context.components[name] = component;
                return app;
            },
            directive(name, directive) {
                context.directives[name] = directive;
                return app;
            },
            mount(rootContainer, isHydrate) {},
            unmount() {},
            provide(key, value) {
                context.provides[key] = value;
                return app;
            }
        });
        return app;
    };
}
```
- createApp
  - createAppContext生成一个context上下文，保存着components、provides、directive等实例
  - 创建app，和context相互引用，同时app上还有use、provide、mixin、directive等方法；
    - 在调用app.component、provide之类的方法时，将组件、provide的值保存到context当中

## app.mount(container)：vue初次渲染???
![mount process](./public/1623225940.jpg)

mount挂载时，将component生成vnode，然后render渲染到container中
```javascript
function createAppAPI(render, hydrate) {
    return function createApp(rootComponent, rootProps = null) {
        const context = createAppContext();
        const installedPlugins = new Set();
        let isMounted = false;
        const app = (context.app = {
            _uid: uid++,
            _component: rootComponent,
            _props: rootProps,
            _container: null,
            _context: context,
            version,
            use(plugin, ...options) {},
            mixin(mixin) {},
            component(name, component) {},
            directive(name, directive) {},
            mount(rootContainer, isHydrate) {
                if (!isMounted) {
                    const vnode = createVNode(rootComponent, rootProps);
                    vnode.appContext = context;
                    if ((process.env.NODE_ENV !== 'production')) {
                        context.reload = () => {
                            render(cloneVNode(vnode), rootContainer);
                        };
                    }
                    render(vnode, rootContainer);
                    
                    isMounted = true;
                    app._container = rootContainer;
                    rootContainer.__vue_app__ = app;
                    return vnode.component.proxy;
                }
            },
            unmount() {},
            provide(key, value) {}
        });
        return app;
    };
}
const createApp = ((...args) => {
    const app = ensureRenderer().createApp(...args); // createApp是上面的createApp方法
    const { mount } = app;
    app.mount = (container) => {
        const component = app._component;
        if (!isFunction(component) && !component.render && !component.template) {
            component.template = container.innerHTML;
        }
        container.innerHTML = ''; // clear content before mounting
        const proxy = mount(container);
        container.removeAttribute('v-cloak');
        container.setAttribute('data-v-app', '');
        return proxy;
    };
    return app;
});
```

render(vnode, container)
```javascript
const render = (vnode, container) => {
    if (vnode == null) {
        if (container._vnode) {
            unmount(container._vnode, null, null, true);
        }
    } else {
        // container._vnode上一次的虚拟节点
        patch(container._vnode || null, vnode, container); // patch上一次的vnode和当前的vnode；当前是初次渲染，所以container._vnode为undefined
    }
    flushPostFlushCbs();
    container._vnode = vnode; // 更新container的vnode
};
```

## <span style="color: red;">ssrApp.mount(container, true) ?</span>
## keep-alive
## effect
## reactive