# Vue3: 响应式原理 - Reactivity
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

reactive一个对象时，在获取对象属性时，如果该属性值是obj，会lazy对这个obj再次进行reactive；
shallowReactive，则遇到属性值为对象时，不会处理，只对最浅的一层属性进行数据劫持

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
## shallowReactive
- set：原始对象属性值为ref时，reactive设置该属性的时候，会修改ref.value；shallow则直接修改这个属性值
- get: 原始值为obj时，reactive对这个对象再次进行reactive处理；shallow直接返回该obj
- get：原始值为ref时，reactive对这个ref进行unWrap再返回；shallow直接返回


```js
const shallowSet = /*#__PURE__*/ createSetter(true);
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
function createGetter(isReadonly = false, shallow = false) {
    return function get(target, key, receiver) {
        if (key === "__v_isReactive" /* IS_REACTIVE */) {
            return !isReadonly;
        }
        else if (key === "__v_isReadonly" /* IS_READONLY */) {
            return isReadonly;
        }
        else if (key === "__v_raw" /* RAW */ &&
            receiver === (isReadonly ? readonlyMap : reactiveMap).get(target)) {
            return target;
        }
        const targetIsArray = isArray(target);
        if (targetIsArray && hasOwn(arrayInstrumentations, key)) {
            return Reflect.get(arrayInstrumentations, key, receiver);
        }
        const res = Reflect.get(target, key, receiver);
        const keyIsSymbol = isSymbol(key);
        if (keyIsSymbol
            ? builtInSymbols.has(key)
            : key === `__proto__` || key === `__v_isRef`) {
            return res;
        }
        if (!isReadonly) {
            track(target, "get" /* GET */, key);
        }
        if (shallow) {
            return res;
        }
        if (isRef(res)) {
            // ref unwrapping - does not apply for Array + integer key.
            const shouldUnwrap = !targetIsArray || !isIntegerKey(key);
            return shouldUnwrap ? res.value : res;
        }
        if (isObject(res)) {
            // Convert returned value into a proxy as well. we do the isObject check
            // here to avoid invalid value warning. Also need to lazy access readonly
            // and reactive here to avoid circular dependency.
            return isReadonly ? readonly(res) : reactive(res);
        }
        return res;
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
        key: dep(new Set()) // name: renderEffect
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


## ref()

> **triggerRef()**: 
> ```javascript
>   triggerRef(){
>       trigger(ref, "set", 'value', (process.env.NODE_ENV !== 'production') ? ref.value : void 0);
>   }
> ```
> 手动触发视图更新

ref和reactive一样, 也是用来实现响应式数据的方法；

- reactive传入对象
- ref除了可以传入对象外，也可以传入普通变量Number，String等

> 如果传入普通类型的数据，则直接赋值给this.value；但原理和reactive一致，在使用或修改ref值的时候进行数据劫持和依赖收集
> 否则会使用reactive处理对象

```javascript
const convert = (val) => isObject(val) ? reactive(val) : val;
class RefImpl {
    constructor(_rawValue, _shallow = false) {
        this._rawValue = _rawValue;
        this._shallow = _shallow;
        this.__v_isRef = true;
        this._value = _shallow ? _rawValue : convert(_rawValue);
    }
    get value() {
        track(toRaw(this), "get" /* GET */, 'value');
        return this._value;
    }
    set value(newVal) {
        if (hasChanged(toRaw(newVal), this._rawValue)) {
            this._rawValue = newVal;
            this._value = this._shallow ? newVal : convert(newVal);
            trigger(toRaw(this), "set" /* SET */, 'value', newVal);
        }
    }
}
function createRef(rawValue, shallow = false) {
    if (isRef(rawValue)) {
        return rawValue;
    }
    return new RefImpl(rawValue, shallow);
}
```

## Computed

Computed基于Effect；和watch类似；

- 页面初渲染，renderEffect，访问到了computed value；computed进行track，将computed和renderEffect保存到targetMap当中；
- 获取computed value（执行Effect，activeEffect为computedEffect），又访问到了响应的variable；variable去track，进行依赖收集，将variable和computedEffect保存到了targetMap中
  
- 页面更新，修改variable值，触发其trigger set；将variable的depsMap中的effects获取到并执行；computedEffect被执行
- computedEffect的scheduler再去trigger set；将computed的depsMap的effects获取并执行；renderEffect被执行
- renderEffect执行queueJob，等待异步更新；
- Promise.then时，页面重新渲染，再次获取computed的value，此时computed的effect()执行，执行**getter()**；获取getter结果并返回；
  
>如果在getter()的时候再去更新computed所侦听的值，也不会死循环，因为variable更新时，将targetMap的deps的effect获取到，依次更新，但是更新的时候会判断effect时候等于activeEffect；所以在variable在getter中再次更新时，由于effect === activeEffect所以computed不会再次执行；所以不会死循环

```js
class ComputedRefImpl {
    constructor(getter, _setter, isReadonly) {
        this._setter = _setter;
        this._dirty = true;
        this.__v_isRef = true;
        this.effect = effect(getter, {
            lazy: true,
            scheduler: () => {
                if (!this._dirty) {
                    this._dirty = true;
                    trigger(toRaw(this), "set" /* SET */, 'value');
                }
            }
        });
        this["__v_isReadonly" /* IS_READONLY */] = isReadonly;
    }
    get value() {
        if (this._dirty) {
            this._value = this.effect();
            this._dirty = false;
        }
        track(toRaw(this), "get" /* GET */, 'value');
        return this._value;
    }
    set value(newValue) {
        this._setter(newValue);
    }
}
```

## targetMap保存了target，key，effect的映射；为何effect也要保存deps?

*问题的流程：*
```js
fn track(){
    targetMap.set(target, depsMap = new Map());
    depsMap.set(key, deps = new Set())
    deps.add(activeEffect);
    activeEffect.deps.push(deps); // why?
}
// trigger时将targetMap中的target的depsMap的key的dep（Set）中所有的effect执行；

// renderEffect执行，会先cleanup(renderEffect)，然后去再让fn()；

function cleanup(effect) {
    const { deps } = effect;
    if (deps.length) {
        for (let i = 0; i < deps.length; i++) {
            deps[i].delete(effect);
        }
        deps.length = 0;
    }
}

```

**实现：**

```js
// templete
<div v-if="isShow">{{computed}}</div>
// js
computed: {
    computed(){
        return this.variable1
    },
    data(){
        return {isShow: true}
    },
    methods:{onChange(){this.isShow = false}}
}
```
>普通的data也是一样，两个data，初始时展示，第二次一个不展示，就需要情况renderEffect

- 数据data：computed，computed所依赖的变量variable1，控制展示的isShow = true；
- 页面：页面< v-if=isShow>{{computed}}</>
- 初始时：
  - a.页面获取isShow，targetMap的isShow的dep：Set(renderEffect)
  - b.页面获取computed，targetMap的computed的dep：Set(renderEffect)
  - c.computed获取variable1，targetM的variable1的dep：Set(computedEffect)
- 更新时-isShow = false：
  - isShow trigger，renderEffect更新
  - renderEffect执行，cleanup(renderEffect)；清空所有a、b的dep中的renderEffect
  - renderEffect的fn()，页面渲染
  - 此时不展示computed的值

**描述：**
- 初始时：renderEffect依赖computed和isShow两个变量。所以computed和isShow各自的dep中都包含renderEffect
- 当onChange执行后，renderEffect执行的时候，renderEffect将computed和variable1中dep中的renderEffect删除，并清空renderEffect的deps；
- 页面重新渲染，isShow为false，computed不再展示；所以computed的get value()并不会再次执行，进而computed不会再次进行track renderEffect；此时只有isShow被renderEffect依赖，computed不再被依赖；；所以只有isShow的dep中包含renderEffect，computed的dep中没有了renderEffect。这便是activeEffect收集它所依赖的数据的dep的原因
- 如果不清空renderEffect的deps中收集的dep中的自己，那么variable变化就会导致页面的更新


**结论：**
多个数据在页面上展示，当数据更新的时候，某个数据不需要再次进行展示了，那么需要将改数据的deps中的renderEffect清空，避免造成页面重复渲染。

由于页面更新后数据所依赖的dep effect发生变化，所以需要在每个effect执行时，将所有依赖自己(effect)的targetMap中的dep中的自己删掉。
在effect中fn执行的时候，重新进行依赖收集


### 两个变量同时修改，如何将重复的刷新过滤掉

- 第一个修改，trigger，将renderEffect scheduler执行queueJob，将Job（effect）加入到queue中；
- 第二个修改，trigger，将renderEffect scheduler执行queueJob，但是queue已经存在了Job（renderEffect），所以renderEffect不会重复插入到queue当中


```js
// templete
{{variable1}}
{{variable2}}
{{variable3}}
// 

```
