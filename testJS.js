// 测试：js的Object的
// 扩展运算符
// let obj = { a: { b: 123 } };
// let obj2 = { ...obj }; // 返回新的对象
// // let obj2 = obj; // 使用的引用
// obj2.a = { b: 2 };
// console.log(obj, obj2);
// 解构赋值
let obj1 = { a: { b: 2 }, c: 3 };
// let { d, ...x } = obj1;
let { a } = obj1;
obj1.a.b = 1;
console.log(a);
