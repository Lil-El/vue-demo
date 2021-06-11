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
 const setupRenderEffect = (instance, initialVNode, container, anchor, parentSuspense, isSVG, optimized) => {
    // create reactive effect for rendering
    instance.update = effect(function componentEffect() {
        if (!instance.isMounted) {
            let vnodeHook;
            const { el, props } = initialVNode;
            const { bm, m, parent } = instance;
            // beforeMount hook
            if (bm) {
                invokeArrayFns(bm);
            }
            // onVnodeBeforeMount
            if ((vnodeHook = props && props.onVnodeBeforeMount)) {
                invokeVNodeHook(vnodeHook, parent, initialVNode);
            }
            // render
            if ((process.env.NODE_ENV !== 'production')) {
                startMeasure(instance, `render`);
            }
            const subTree = (instance.subTree = renderComponentRoot(instance));
            if ((process.env.NODE_ENV !== 'production')) {
                endMeasure(instance, `render`);
            }
            if (el && hydrateNode) {
                if ((process.env.NODE_ENV !== 'production')) {
                    startMeasure(instance, `hydrate`);
                }
                // vnode has adopted host node - perform hydration instead of mount.
                hydrateNode(initialVNode.el, subTree, instance, parentSuspense);
                if ((process.env.NODE_ENV !== 'production')) {
                    endMeasure(instance, `hydrate`);
                }
            }
            else {
                if ((process.env.NODE_ENV !== 'production')) {
                    startMeasure(instance, `patch`);
                }
                patch(null, subTree, container, anchor, instance, parentSuspense, isSVG);
                if ((process.env.NODE_ENV !== 'production')) {
                    endMeasure(instance, `patch`);
                }
                initialVNode.el = subTree.el;
            }
            // mounted hook
            if (m) {
                queuePostRenderEffect(m, parentSuspense);
            }
            // onVnodeMounted
            if ((vnodeHook = props && props.onVnodeMounted)) {
                queuePostRenderEffect(() => {
                    invokeVNodeHook(vnodeHook, parent, initialVNode);
                }, parentSuspense);
            }
            // activated hook for keep-alive roots.
            // #1742 activated hook must be accessed after first render
            // since the hook may be injected by a child keep-alive
            const { a } = instance;
            if (a &&
                initialVNode.shapeFlag & 256 /* COMPONENT_SHOULD_KEEP_ALIVE */) {
                queuePostRenderEffect(a, parentSuspense);
            }
            instance.isMounted = true;
        }
        else {
            // updateComponent
            // This is triggered by mutation of component's own state (next: null)
            // OR parent calling processComponent (next: VNode)
            let { next, bu, u, parent, vnode } = instance;
            let originNext = next;
            let vnodeHook;
            if ((process.env.NODE_ENV !== 'production')) {
                pushWarningContext(next || instance.vnode);
            }
            if (next) {
                updateComponentPreRender(instance, next, optimized);
            }
            else {
                next = vnode;
            }
            next.el = vnode.el;
            // beforeUpdate hook
            if (bu) {
                invokeArrayFns(bu);
            }
            // onVnodeBeforeUpdate
            if ((vnodeHook = next.props && next.props.onVnodeBeforeUpdate)) {
                invokeVNodeHook(vnodeHook, parent, next, vnode);
            }
            // render
            if ((process.env.NODE_ENV !== 'production')) {
                startMeasure(instance, `render`);
            }
            const nextTree = renderComponentRoot(instance);
            if ((process.env.NODE_ENV !== 'production')) {
                endMeasure(instance, `render`);
            }
            const prevTree = instance.subTree;
            instance.subTree = nextTree;
            // reset refs
            // only needed if previous patch had refs
            if (instance.refs !== EMPTY_OBJ) {
                instance.refs = {};
            }
            if ((process.env.NODE_ENV !== 'production')) {
                startMeasure(instance, `patch`);
            }
            patch(prevTree, nextTree, 
            // parent may have changed if it's in a teleport
            hostParentNode(prevTree.el), 
            // anchor may have changed if it's in a fragment
            getNextHostNode(prevTree), instance, parentSuspense, isSVG);
            if ((process.env.NODE_ENV !== 'production')) {
                endMeasure(instance, `patch`);
            }
            next.el = nextTree.el;
            if (originNext === null) {
                // self-triggered update. In case of HOC, update parent component
                // vnode el. HOC is indicated by parent instance's subTree pointing
                // to child component's vnode
                updateHOCHostEl(instance, nextTree.el);
            }
            // updated hook
            if (u) {
                queuePostRenderEffect(u, parentSuspense);
            }
            // onVnodeUpdated
            if ((vnodeHook = next.props && next.props.onVnodeUpdated)) {
                queuePostRenderEffect(() => {
                    invokeVNodeHook(vnodeHook, parent, next, vnode);
                }, parentSuspense);
            }
            if ((process.env.NODE_ENV !== 'production') || __VUE_PROD_DEVTOOLS__) {
                devtoolsComponentUpdated(instance);
            }
            if ((process.env.NODE_ENV !== 'production')) {
                popWarningContext();
            }
        }
    }, (process.env.NODE_ENV !== 'production') ? createDevEffectOptions(instance) : prodEffectOptions);
};
```

## <span style="color: red;">ssrApp.mount(container, true) ?</span>
## keep-alive
## effect
## LifeCycle Hook
```javascript

const createHook = (lifecycle) => (hook, target = currentInstance) => 
!isInSSRComponentSetup && injectHook(lifecycle, hook, target);

const onBeforeMount = createHook("bm" /* BEFORE_MOUNT */);

function injectHook(type, hook, target = currentInstance, prepend = false) {
    if (target) {
        const hooks = target[type] || (target[type] = []);
        const wrappedHook = hook.__weh ||
            (hook.__weh = (...args) => {
                if (target.isUnmounted) {
                    return;
                }
                // 在效果中禁用所有生命周期钩子的跟踪。 disable tracking inside all lifecycle hooks inside effects.
                pauseTracking();
                // Set currentInstance during hook invocation.
                // This assumes the hook does not synchronously trigger other hooks, which
                // can only be false when the user does something really funky.
                setCurrentInstance(target);
                const res = callWithAsyncErrorHandling(hook, target, type, args);
                setCurrentInstance(null);
                resetTracking();
                return res;
            });
        if (prepend) {
            hooks.unshift(wrappedHook);
        }
        else {
            hooks.push(wrappedHook);
        }
        return wrappedHook;
    }
}
function callWithAsyncErrorHandling(fn, instance, type, args) {
    if (isFunction(fn)) {
        const res = callWithErrorHandling(fn, instance, type, args); // 调用fn执行传入args
        if (res && isPromise(res)) {
            res.catch(err => {
                handleError(err, instance, type);
            });
        }
        return res;
    }
    const values = [];
    for (let i = 0; i < fn.length; i++) {
        values.push(callWithAsyncErrorHandling(fn[i], instance, type, args));
    }
    return values;
}
```