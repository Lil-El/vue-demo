# Part Vue3

## 为什么Composition API可以获取到currentInstance
**:compositionAPI.js**
```javascript
var Plugin = {
    install: function (Vue) { return install(Vue); },
};

if (typeof window !== 'undefined' && window.Vue) {
    window.Vue.use(Plugin);
}

export default Plugin;
```
因为：compositionAPI包含了一个plugin，在import vue的时候，会执行window.Vue.use(Plugin)，将Vue注入到compositionAPI当中。