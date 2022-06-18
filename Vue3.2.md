# [Vue3.2][1]

- 响应式实现的优化

## Vue3响应式原理

### Vue3.2之前

    本质：通过Proxy代理，对object的读写进行数据劫持；当访问数据的时候通过getter进行依赖收集；当修改数据的时候进行派发通知。

#### 依赖收集

```js
let shouldTrack = true
let activeEffect
const targetMap = new WeakMap()
function track(target, type, key) {
  let depsMap = targetMap.get(target)
  if (!depsMap) {
    targetMap.set(target, (depsMap = new Map()))
  }
  let dep = depsMap.get(key)
  if (!dep) {
    depsMap.set(key, (dep = new Set()))
  }
  if (!dep.has(activeEffect)) {
    dep.add(activeEffect)
    activeEffect.deps.push(dep)
  }
}
```
```js
// 全局 effect 栈
const effectStack = []
// 当前激活的 effect
let activeEffect
function effect(fn, options = EMPTY_OBJ) {
  if (isEffect(fn)) {
    // 如果 fn 已经是一个 effect 函数了，则指向原始函数
    fn = fn.raw
  }
  // 创建一个 wrapper，它是一个响应式的副作用的函数
  const effect = createReactiveEffect(fn, options)
  if (!options.lazy) {
    // lazy 配置，计算属性会用到，非 lazy 则直接执行一次
    effect()
  }
  return effect
}
function createReactiveEffect(fn, options) {
  const effect = function reactiveEffect() {
    if (!effect.active) {
      // 非激活状态，则判断如果非调度执行，则直接执行原始函数。
      return options.scheduler ? undefined : fn()
    }
    if (!effectStack.includes(effect)) {
      // 清空 effect 引用的依赖
      cleanup(effect)
      try {
        // 开启全局 shouldTrack，允许依赖收集
        enableTracking()
        // 压栈
        effectStack.push(effect)
        activeEffect = effect
        // 执行原始函数
        return fn()
      }
      finally {
        // 出栈
        effectStack.pop()
        // 恢复 shouldTrack 开启之前的状态
        resetTracking()
        // 指向栈最后一个 effect
        activeEffect = effectStack[effectStack.length - 1]
      }
    }
  }
  effect.id = uid++
  // 标识是一个 effect 函数
  effect._isEffect = true
  // effect 自身的状态
  effect.active = true
  // 包装的原始函数
  effect.raw = fn
  // effect 对应的依赖，双向指针，依赖包含对 effect 的引用，effect 也包含对依赖的引用
  effect.deps = []
  // effect 的相关配置
  effect.options = options
  return effect
}
```
![依赖关系](/doc/relate.png)

### Vue3.2

#### 依赖收集优化

`cleanup(effect)`会在每次effect更新的时候执行，将effect deps中的自己清除掉。保证下次如果某个数据不在依赖effect的时候，可以仍然符合预期地去渲染，避免因为不渲染的数据更新时再次渲染视图。

但是大部分场景中依赖关系很少改变，所以`effect`的`cleanup`操作牵扯大量的**Set**的添加和删除操作。因此这里还是有一定的优化空间。

为了减少`Set`的添加和删除操作，我们需要为Set添加标识w、n

```js
let effectTrackDepth = 0; // 
let trackOpBit = 1;
const maxMarkerBits = 30;

const createDep = (effects) => {
    const dep = new Set(effects);
    dep.w = 0;
    dep.n = 0;
    return dep;
};
const wasTracked = (dep) => (dep.w & trackOpBit) > 0;
const newTracked = (dep) => (dep.n & trackOpBit) > 0;
const initDepMarkers = ({ deps }) => {
    if (deps.length) {
        for (let i = 0; i < deps.length; i++) {
            deps[i].w |= trackOpBit; // set was tracked
        }
    }
};
const finalizeDepMarkers = (effect) => {
    const { deps } = effect;
    if (deps.length) {
        let ptr = 0;
        for (let i = 0; i < deps.length; i++) {
            const dep = deps[i];
            if (wasTracked(dep) && !newTracked(dep)) {
                dep.delete(effect);
            }
            else {
                deps[ptr++] = dep;
            }
            // clear bits
            dep.w &= ~trackOpBit;
            dep.n &= ~trackOpBit;
        }
        deps.length = ptr;
    }
};
```

3.2中track逻辑被拆分为track和trackEffects两部分；trigger相同；

- track主要为了从targetMap的target的key中获取dep，并初始化对应的key、dep对象
- trackEffect为dep添加effect

3.2前，由于ref等对象的依赖收集、派发通知每次需要track，使得每次要对target、key等属性进行判断操作；
3.2，对track进行拆分，ref从以前的执行track全部变为只执行trackEffects部分，trigger一样；减少判断操作，从而达到优化效果；

```js
function track(target, type, key) {
    let depsMap = targetMap.get(target);
    if (!depsMap) {
        targetMap.set(target, (depsMap = new Map()));
    }
    let dep = depsMap.get(key);
    if (!dep) {
        depsMap.set(key, (dep = createDep()));
    }
    const eventInfo = { effect: activeEffect, target, type, key };
    trackEffects(dep, eventInfo);
}

function trackEffects(dep, debuggerEventExtraInfo) {
    let shouldTrack = false;
    if (effectTrackDepth <= maxMarkerBits) {
        if (!newTracked(dep)) {
            dep.n |= trackOpBit; // 重新设置被跟踪tracked
            shouldTrack = !wasTracked(dep);
        }
    }
    else {
        shouldTrack = !dep.has(activeEffect);
    }
    // Mino: 以前直接添加activeEffect到dep当中；现在做了判断shouldTrack
    if (shouldTrack) { 
        dep.add(activeEffect);
        activeEffect.deps.push(dep);
    }
}

function trigger(target, type, key, newValue, oldValue, oldTarget) {
    const depsMap = targetMap.get(target);
    let deps = [];
    if (type === "clear" /* CLEAR */) {
        // collection being cleared
        // trigger all effects for target
        deps = [...depsMap.values()];
    }
    else if (key === 'length' && isArray(target)) {
        depsMap.forEach((dep, key) => {
            if (key === 'length' || key >= newValue) {
                deps.push(dep);
            }
        });
    }
    else {
        // schedule runs for SET | ADD | DELETE
        if (key !== void 0) {
            deps.push(depsMap.get(key));
        }
        // also run for iteration key on ADD | DELETE | Map.SET
        switch (type) {
            case "add" /* ADD */:
                if (!isArray(target)) {
                    deps.push(depsMap.get(ITERATE_KEY));
                    if (isMap(target)) {
                        deps.push(depsMap.get(MAP_KEY_ITERATE_KEY));
                    }
                }
                else if (isIntegerKey(key)) {
                    deps.push(depsMap.get('length'));
                }
                break;
            case "delete" /* DELETE */:
                if (!isArray(target)) {
                    deps.push(depsMap.get(ITERATE_KEY));
                    if (isMap(target)) {
                        deps.push(depsMap.get(MAP_KEY_ITERATE_KEY));
                    }
                }
                break;
            case "set" /* SET */:
                if (isMap(target)) {
                    deps.push(depsMap.get(ITERATE_KEY));
                }
                break;
        }
    }
    const eventInfo = { target, type, key, newValue, oldValue, oldTarget };
    if (deps.length === 1) {
        if (deps[0]) {
            {
                triggerEffects(deps[0], eventInfo);
            }
        }
    }
    else {
        const effects = [];
        for (const dep of deps) {
            if (dep) {
                effects.push(...dep);
            }
        }
        {
            triggerEffects(createDep(effects), eventInfo);
        }
    }
}
function triggerEffects(dep, debuggerEventExtraInfo) {
    // spread into array for stabilization
    for (const effect of isArray(dep) ? dep : [...dep]) {
        if (effect !== activeEffect || effect.allowRecurse) {
            if (effect.onTrigger) {
                effect.onTrigger(extend({ effect }, debuggerEventExtraInfo));
            }
            if (effect.scheduler) {
                effect.scheduler();
            }
            else {
                effect.run();
            }
        }
    }
}
```

```js
class ReactiveEffect {
    constructor(fn, scheduler = null, scope) {
        this.fn = fn;
        this.scheduler = scheduler;
        this.active = true;
        this.deps = [];
        recordEffectScope(this, scope);
    }
    run() {
        if (!this.active) {
            return this.fn();
        }
        if (!effectStack.includes(this)) {
            try {
                effectStack.push((activeEffect = this));
                enableTracking();
                trackOpBit = 1 << ++effectTrackDepth;
                if (effectTrackDepth <= maxMarkerBits) {
                    initDepMarkers(this);
                }
                else {
                    cleanupEffect(this);
                }
                return this.fn();
            }
            finally {
                if (effectTrackDepth <= maxMarkerBits) {
                    finalizeDepMarkers(this);
                }
                trackOpBit = 1 << --effectTrackDepth;
                resetTracking();
                effectStack.pop();
                const n = effectStack.length;
                activeEffect = n > 0 ? effectStack[n - 1] : undefined;
            }
        }
    }
    stop() {
        if (this.active) {
            cleanupEffect(this);
            if (this.onStop) {
                this.onStop();
            }
            this.active = false;
        }
    }
}
function cleanupEffect(effect) {
    const { deps } = effect;
    if (deps.length) {
        for (let i = 0; i < deps.length; i++) {
            deps[i].delete(effect);
        }
        deps.length = 0;
    }
}
function effect(fn, options) {
    if (fn.effect) {
        fn = fn.effect.fn;
    }
    const _effect = new ReactiveEffect(fn);
    if (options) {
        extend(_effect, options);
        if (options.scope)
            recordEffectScope(_effect, options.scope);
    }
    if (!options || !options.lazy) {
        _effect.run();
    }
    const runner = _effect.run.bind(_effect);
    runner.effect = _effect;
    return runner;
}
```

trackOpBit设计：每一层effect需要为trackOpBit左移一位，表示当前层的标记

初始化：dep收集了effect；
1. 变量变化：effect.run执行，先initDepMarkers初始化依赖标记，给dep.w赋值为trackOpBit；
         变量的getter->track->  此时dep.n = 0;所以需要被收集dep.n赋值为trackOpBit；
         run结束时：判断如果 (被收集了&&不是新的dep) 需要被清除掉，**没被清除掉**，然后w和n &= ^trackOpBit 清空状态
2. 变量不展示：effect.run执行，先initDepMarkers初始化依赖标记，给dep.w赋值为trackOpBit；
              变量的getter->track没有执行  此时dep.n = 0
              run结束时：判断如果 (被收集了&&不是新的dep) 需要被清除掉，**被清除掉**，然后w和n &= ^trackOpBit 清空状态

## Vue3.2 ref优化

3.2中track逻辑被拆分为track和trackEffects两部分；trigger相同；

- track主要为了从targetMap的target的key中获取dep，并初始化对应的key、dep对象
- trackEffect为dep添加effect

3.2前，由于ref等对象的依赖收集、派发通知每次需要track，使得每次要对target、key等属性进行判断操作；
3.2，对track进行拆分，ref从以前的执行track全部变为只执行trackEffects部分，trigger一样；减少判断操作，从而达到优化效果；

3.2以前的ref代码：

```js
function ref(value) {
  return createRef(value)
}

const convert = (val) => isObject(val) ? reactive(val) : val

function createRef(rawValue, shallow = false) {
  if (isRef(rawValue)) {
    // 如果传入的就是一个 ref，那么返回自身即可，处理嵌套 ref 的情况。
    return rawValue
  }
  return new RefImpl(rawValue, shallow)
}

class RefImpl {
  constructor(_rawValue, _shallow = false) {
    this._rawValue = _rawValue
    this._shallow = _shallow
    this.__v_isRef = true
    // 非 shallow 的情况，如果它的值是对象或者数组，则递归响应式
    this._value = _shallow ? _rawValue : convert(_rawValue)
  }
  get value() {
    // 给 value 属性添加 getter，并做依赖收集
    track(toRaw(this), 'get' /* GET */, 'value')
    return this._value
  }
  set value(newVal) {
    // 给 value 属性添加 setter
    if (hasChanged(toRaw(newVal), this._rawValue)) {
      this._rawValue = newVal
      this._value = this._shallow ? newVal : convert(newVal)
      // 派发通知
      trigger(toRaw(this), 'set' /* SET */, 'value', newVal)
    }
  }
}
```

3.2的ref代码

```js
class RefImpl {
  constructor(value, _shallow = false) {
    this._shallow = _shallow
    this.dep = undefined
    this.__v_isRef = true
    this._rawValue = _shallow ? value : toRaw(value)
    this._value = _shallow ? value : convert(value)
  }
  get value() {
    trackRefValue(this)
    return this._value
  }
  set value(newVal) {
    newVal = this._shallow ? newVal : toRaw(newVal)
    if (hasChanged(newVal, this._rawValue)) {
      this._rawValue = newVal
      this._value = this._shallow ? newVal : convert(newVal)
      triggerRefValue(this, newVal)
    }
  }
}

function trackRefValue(ref) {
  if (isTracking()) {
    ref = toRaw(ref)
    if (!ref.dep) {
      ref.dep = createDep()
    }
    if ((process.env.NODE_ENV !== 'production')) {
      trackEffects(ref.dep, {
        target: ref,
        type: "get" /* GET */,
        key: 'value'
      })
    }
    else {
      trackEffects(ref.dep)
    }
  }
}
function triggerRefValue(ref, newVal) {
  ref = toRaw(ref)
  if (ref.dep) {
    if ((process.env.NODE_ENV !== 'production')) {
      triggerEffects(ref.dep, {
        target: ref,
        type: "set" /* SET */,
        key: 'value',
        newValue: newVal
      })
    }
    else {
      triggerEffects(ref.dep)
    }
  }
}

function triggerEffects(dep, debuggerEventExtraInfo) {
  for (const effect of isArray(dep) ? dep : [...dep]) {
    if (effect !== activeEffect || effect.allowRecurse) {
      if ((process.env.NODE_ENV !== 'production') && effect.onTrigger) {
        effect.onTrigger(extend({ effect }, debuggerEventExtraInfo))
      }
      if (effect.scheduler) {
        effect.scheduler()
      }
      else {
        effect.run()
      }
    }
  }
}

```


[1]: https://juejin.cn/post/6995732683435278344#heading-6