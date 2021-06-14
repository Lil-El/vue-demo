# Reactivity - Vue3响应式原理
`数据劫持` `依赖收集`


在vue3中定义响应式对象，用法如下：
```javascript
import {reactive} from 'vue';

let state = reactive({
    name: "MINO"
})

```
- markRaw：给value标记SKIP
- toRaw：返回observed对象（proxy）的RAW属性对象，就是target对象
   ```
    function toRaw(observed) {
        return ((observed && toRaw(observed["__v_raw" /* RAW */])) || observed);
    }
    ```
## Reactive
`reactivity.esm-bundler.js`
```javascript
fn reactivity(target){
    return createReactiveObject(target, false, baseHandlers, collectionHandlers)
}

const reactiveMap = new WeakMap();
// 判断是不是对象，不是就返回obj
// 判断target是否已经被代理，是就返回target代理的proxy
// 判断target的type是SKIP（被markRaw标记）则返回target
// 代理：如果target的type是obj，arr则使用baseHandlers；如果target是set，map，weakSet，weakMap则使用collectionHandlers
function createReactiveObject(target, isReadonly, baseHandlers, collectionHandlers) {
    if (!isObject(target)) {
        return target;
    }
    // target is already a Proxy, return it.
    // exception: calling readonly() on a reactive object
    if (target["__v_raw" /* RAW */] &&
        !(isReadonly && target["__v_isReactive" /* IS_REACTIVE */])) {
        return target;
    }
    // target already has corresponding Proxy
    const proxyMap = isReadonly ? readonlyMap : reactiveMap;
    const existingProxy = proxyMap.get(target);
    if (existingProxy) {
        return existingProxy;
    }
    // only a whitelist of value types can be observed.
    const targetType = getTargetType(target); // 如果targetType是SKIP则返回0，obj/arr返回1，set/map/weak返回1
    if (targetType === 0 /* INVALID */) {
        return target;
    }
    const proxy = new Proxy(target, targetType === 2 /* COLLECTION */ ? collectionHandlers : baseHandlers);
    proxyMap.set(target, proxy);
    return proxy;
}

// 数组方法改写，将数组的方法改写到arrayInstrumentations对象中，在调用数组的方法时，Reflect映射到arrayInstrumentations上
const arrayInstrumentations = {};
['includes', 'indexOf', 'lastIndexOf'].forEach(key => {
    const method = Array.prototype[key];
    arrayInstrumentations[key] = function (...args) {
        const arr = toRaw(this);
        for (let i = 0, l = this.length; i < l; i++) {
            track(arr, "get" /* GET */, i + '');
        }
        // we run the method using the original args first (which may be reactive)
        const res = method.apply(arr, args);
        if (res === -1 || res === false) {
            // if that didn't work, run it again using raw values.
            return method.apply(arr, args.map(toRaw));
        }
        else {
            return res;
        }
    };
});
['push', 'pop', 'shift', 'unshift', 'splice'].forEach(key => {
    const method = Array.prototype[key];
    arrayInstrumentations[key] = function (...args) {
        pauseTracking();
        const res = method.apply(this, args);
        enableTracking();
        return res;
    };
});

baseHandlers = {
    get: createGetter(),
    set: createSetter(),
    deleteProperty: fn deleteProperty,
    has: fn has,
    ownKeys: fn ownKeys
}
function createGetter(isReadonly = false, shallow = false) {
    return function get(target, key, receiver) {
        // sth code...
        if (key === "__v_raw" /* RAW */ &&
            receiver === (isReadonly ? readonlyMap : reactiveMap).get(target)) {
            return target;
        }
        const targetIsArray = isArray(target);
        if (targetIsArray && hasOwn(arrayInstrumentations, key)) {
            return Reflect.get(arrayInstrumentations, key, receiver);
        }
        const res = Reflect.get(target, key, receiver);
        track(target, "get" /* GET */, key);
        if (isObject(res)) {
            return isReadonly ? readonly(res) : reactive(res);
        }
        return res;
    };
}

function createSetter(shallow = false) {
    return function set(target, key, value, receiver) {
        const oldValue = target[key];
        if (!shallow) {
            value = toRaw(value);
            if (!isArray(target) && isRef(oldValue) && !isRef(value)) {
                oldValue.value = value;
                return true;
            }
        }
        const hadKey = isArray(target) && isIntegerKey(key)
            ? Number(key) < target.length
            : hasOwn(target, key);
        const result = Reflect.set(target, key, value, receiver);
        // don't trigger if target is something up in the prototype chain of original
        // 添加新属性或者修改属性
        if (target === toRaw(receiver)) {
            if (!hadKey) {
                trigger(target, "add" /* ADD */, key, value);
            }
            else if (hasChanged(value, oldValue)) {
                trigger(target, "set" /* SET */, key, value, oldValue);
            }
        }
        return result;
    };
}
```

## Effect
```javascript

const targetMap = new WeakMap();
const effectStack = [];
let activeEffect;
const ITERATE_KEY = Symbol((process.env.NODE_ENV !== 'production') ? 'iterate' : '');
const MAP_KEY_ITERATE_KEY = Symbol((process.env.NODE_ENV !== 'production') ? 'Map key iterate' : '');
function isEffect(fn) {
    return fn && fn._isEffect === true;
}
function effect(fn, options = EMPTY_OBJ) {
    if (isEffect(fn)) {
        fn = fn.raw;
    }
    const effect = createReactiveEffect(fn, options);
    if (!options.lazy) {
        effect();
    }
    return effect;
}
function stop(effect) {
    if (effect.active) {
        cleanup(effect);
        if (effect.options.onStop) {
            effect.options.onStop();
        }
        effect.active = false;
    }
}
let uid = 0;
function createReactiveEffect(fn, options) {
    const effect = function reactiveEffect() {
        if (!effect.active) {
            return options.scheduler ? undefined : fn();
        }
        if (!effectStack.includes(effect)) {
            cleanup(effect);
            try {
                enableTracking();
                effectStack.push(effect);
                activeEffect = effect;
                return fn();
            }
            finally {
                effectStack.pop();
                resetTracking();
                activeEffect = effectStack[effectStack.length - 1];
            }
        }
    };
    effect.id = uid++;
    effect._isEffect = true;
    effect.active = true;
    effect.raw = fn;
    effect.deps = [];
    effect.options = options;
    return effect;
}
function cleanup(effect) {
    const { deps } = effect;
    if (deps.length) {
        for (let i = 0; i < deps.length; i++) {
            deps[i].delete(effect);
        }
        deps.length = 0;
    }
}
let shouldTrack = true;
const trackStack = [];
function pauseTracking() {
    trackStack.push(shouldTrack);
    shouldTrack = false;
}
function enableTracking() {
    trackStack.push(shouldTrack);
    shouldTrack = true;
}
function resetTracking() {
    const last = trackStack.pop();
    shouldTrack = last === undefined ? true : last;
}
function track(target, type, key) {
    if (!shouldTrack || activeEffect === undefined) {
        return;
    }
    let depsMap = targetMap.get(target);
    if (!depsMap) {
        targetMap.set(target, (depsMap = new Map()));
    }
    let dep = depsMap.get(key);
    if (!dep) {
        depsMap.set(key, (dep = new Set()));
    }
    if (!dep.has(activeEffect)) {
        dep.add(activeEffect);
        activeEffect.deps.push(dep);
    }
}
function trigger(target, type, key, newValue, oldValue, oldTarget) {
    const depsMap = targetMap.get(target);
    const effects = new Set();
    const add = (effectsToAdd) => {
        if (effectsToAdd) {
            effectsToAdd.forEach(effect => {
                if (effect !== activeEffect || effect.options.allowRecurse) {
                    effects.add(effect);
                }
            });
        }
    };
    if (type === "clear" /* CLEAR */) {
        // collection being cleared
        // trigger all effects for target
        depsMap.forEach(add);
    }
    else if (key === 'length' && isArray(target)) {
        depsMap.forEach((dep, key) => {
            if (key === 'length' || key >= newValue) {
                add(dep);
            }
        });
    }
    else {
        // schedule runs for SET | ADD | DELETE
        if (key !== void 0) {
            add(depsMap.get(key));
        }
        // also run for iteration key on ADD | DELETE | Map.SET
        switch (type) {
            case "add" /* ADD */:
                if (!isArray(target)) {
                    add(depsMap.get(ITERATE_KEY));
                    if (isMap(target)) {
                        add(depsMap.get(MAP_KEY_ITERATE_KEY));
                    }
                }
                else if (isIntegerKey(key)) {
                    // new index added to array -> length changes
                    add(depsMap.get('length'));
                }
                break;
            case "delete" /* DELETE */:
                if (!isArray(target)) {
                    add(depsMap.get(ITERATE_KEY));
                    if (isMap(target)) {
                        add(depsMap.get(MAP_KEY_ITERATE_KEY));
                    }
                }
                break;
            case "set" /* SET */:
                if (isMap(target)) {
                    add(depsMap.get(ITERATE_KEY));
                }
                break;
        }
    }
    const run = (effect) => {
        if (effect.options.scheduler) {
            effect.options.scheduler(effect);
        }
        else {
            effect();
        }
    };
    effects.forEach(run);
}
```
**target和deps存储结构：**
target = {name: "yyy"};
reactive(target);

```javascript
    targetMap(WeakMap): {
        target: depsMap(new Map())
    }
    depsMap(Map): {
        key: dep(new Set())
    }
```

## reactive值在页面的流程
- 展示：get()
  当页面使用reactive的值时，触发getter()方法，并进行track()对依赖进行跟踪；
  内部有一个targetMap，保存着target对象和deps的映射；而depsMap保存着key和deps的映射关系；
  此时，将activeEffect(renderEffect)存储到key对应的deps（Set）当中。
- 修改：set()
  当state的属性值发生变化，进行修改时。触发setter()方法，并执行trigger方法，对这个key的依赖deps进行更新；
  获取到target的depsMap，再获取key的deps，然后每一个dep（render effect）执行更新。

## 异步更新

接着上面的`修改：set()`，当effect更新的时候，会先执行effect option上的scheduler方法，即queueJob(effect)；
将effect保存到queue队列当中。并判断队列当中是否已经有了这个effect，没有就加入到队列当中。在本轮事件循环结束时，即在微任务开始，去执行effect的update方法，更新页面。

>nextTick：vue3的nextTick使用promise.then来实现；vue2当中做了兼容处理：使用mutationObserve，setTimeout等
>vue3使用proxy，所以一定也是支持es6和promise的，所以就不需要对nextTick做兼容处理

```javascript
let isFlushing = false;
let isFlushPending = false;
const queue = [];
const resolvedPromise = Promise.resolve();
function nextTick(fn) {
    const p = currentFlushPromise || resolvedPromise;
    return fn ? p.then(fn) : p;
}
function queueJob(job) {
    if ((!queue.length || !queue.includes(job, isFlushing && job.allowRecurse ? flushIndex + 1 : flushIndex)) &&
        job !== currentPreFlushParentJob) {
        queue.push(job);
        queueFlush();
    }
}
function queueFlush() {
    if (!isFlushing && !isFlushPending) {
        isFlushPending = true;
        currentFlushPromise = resolvedPromise.then(flushJobs);
    }
}

function flushJobs(seen) {
    isFlushPending = false;
    isFlushing = true;
    if ((process.env.NODE_ENV !== 'production')) {
        seen = seen || new Map();
    }
    flushPreFlushCbs(seen); // beforeUpdate
    queue.sort((a, b) => getId(a) - getId(b));
    try {
        for (flushIndex = 0; flushIndex < queue.length; flushIndex++) {
            const job = queue[flushIndex];
            if (job) {
                if ((process.env.NODE_ENV !== 'production')) {
                    checkRecursiveUpdates(seen, job);
                }
                callWithErrorHandling(job, null, 14 /* SCHEDULER */);
            }
        }
    }
    finally {
        flushIndex = 0;
        queue.length = 0;
        flushPostFlushCbs(seen); // updated
        isFlushing = false;
        currentFlushPromise = null;
        if (queue.length || pendingPostFlushCbs.length) {
            flushJobs(seen);
        }
    }
}
```

## watch
watch指定getter的返回值为依赖，当返回值变化才执行回调；

watch接收两个参数，getter和callback和options；
- getter：function | ref | reactive | array；
- optionn：接收onStop函数，在取消监听时执行

返回暂停的钩子函数，执行可以取消监听
>vue3的watch支持监听多个变量

- 1. watch内部会将getter包装为函数
- 2. 将getter传入到effect当中，并返回runner（scheduler不再是queueJob）
- 3. 将runner effect保存到instance的effects上，便于unMount时取消监听
- 4. 执行runner()，即effect执行，此时activeEffect为runner，调用getter执行会将activeEffect添加到对应reactive值的deps当中。在值变化时就可以触发watch的callback执行
- 5. 返回stop函数，调用可以取消watch监听（设置effect.active为false，effect()执行时便不再执行）


```javascript
const INITIAL_WATCHER_VALUE = {};
// implementation
function watch(source, cb, options) {
    return doWatch(source, cb, options);
}
function doWatch(source, cb, { immediate, deep, flush, onTrack, onTrigger } = EMPTY_OBJ, instance = currentInstance) {
    
    let getter;
    const isRefSource = isRef(source);
    if (isRefSource) {
        getter = () => source.value;
    }
    else if (isReactive(source)) {
        getter = () => source;
        deep = true;
    }
    else if (isArray(source)) {
        getter = () => source.map(s => {
            if (isRef(s)) {
                return s.value;
            }
            else if (isReactive(s)) {
                return traverse(s);
            }
            else if (isFunction(s)) {
                return callWithErrorHandling(s, instance, 2 /* WATCH_GETTER */);
            }
            else {
                (process.env.NODE_ENV !== 'production') && warnInvalidSource(s);
            }
        });
    }
    else if (isFunction(source)) {
        if (cb) {
            // getter with cb
            getter = () => callWithErrorHandling(source, instance, 2 /* WATCH_GETTER */);
        }
        else {
            // no cb -> simple effect
            getter = () => {
                if (instance && instance.isUnmounted) {
                    return;
                }
                if (cleanup) {
                    cleanup();
                }
                return callWithErrorHandling(source, instance, 3 /* WATCH_CALLBACK */, [onInvalidate]);
            };
        }
    }
    else {
        getter = NOOP;
    }
    if (cb && deep) {
        const baseGetter = getter;
        getter = () => traverse(baseGetter());
    }
    let cleanup;
    const onInvalidate = (fn) => {
        cleanup = runner.options.onStop = () => {
            callWithErrorHandling(fn, instance, 4 /* WATCH_CLEANUP */);
        };
    };
    let oldValue = isArray(source) ? [] : INITIAL_WATCHER_VALUE;
    const job = () => {
        if (cb) {
            // watch(source, cb)
            const newValue = runner();
            if (deep || isRefSource || hasChanged(newValue, oldValue)) {
                // cleanup before running cb again
                if (cleanup) {
                    cleanup();
                }
                callWithAsyncErrorHandling(cb, instance, 3 /* WATCH_CALLBACK */, [
                    newValue,
                    // pass undefined as the old value when it's changed for the first time
                    oldValue === INITIAL_WATCHER_VALUE ? undefined : oldValue,
                    onInvalidate
                ]);
                oldValue = newValue;
            }
        }
        else {
            // watchEffect
            runner();
        }
    };
    // important: mark the job as a watcher callback so that scheduler knows it
    // it is allowed to self-trigger (#1727)
    job.allowRecurse = !!cb;
    let scheduler;
    if (flush === 'sync') {
        scheduler = job;
    }
    else if (flush === 'post') {
        scheduler = () => queuePostRenderEffect(job, instance && instance.suspense);
    }
    else {
        // default: 'pre'
        scheduler = () => {
            if (!instance || instance.isMounted) {
                queuePreFlushCb(job);
            }
            else {
                // with 'pre' option, the first call must happen before
                // the component is mounted so it is called synchronously.
                job();
            }
        };
    }
    const runner = effect(getter, {
        lazy: true,
        onTrack,
        onTrigger,
        scheduler
    });
    recordInstanceBoundEffect(runner); // 将effect-runner保存到instance的effects中，便于在unMount的时候取消监听
    // initial run
    if (cb) {
        if (immediate) {
            job();
        }
        else {
            oldValue = runner();
        }
    }
    else if (flush === 'post') {
        queuePostRenderEffect(runner, instance && instance.suspense);
    }
    else {
        runner();
    }
    return () => {
        stop(runner);
        if (instance) {
            remove(instance.effects, runner);
        }
    };
}

```

## watchEffect

```javascript
let state = reactive({name: 1});
watchEffect(()=>{console.log(state.name)})
```
**不同**
- watchEffect和watch相比，watchEffect没有回调函数；
- watchEffect自动引入依赖，当参数中的值变化时便出发runner函数执行；watch根据oldValue变化才执行cb
- watchEffect相较于watch，无法获取新、旧的值
**相同**
- 默认都在preCb中执行job()
- 都会在setup执行的时候，都执行runner()，使监听的对象能够进行依赖收集

```javascript
// Simple effect.
function watchEffect(effect, options) {
    return doWatch(effect, null, options);
}
```

