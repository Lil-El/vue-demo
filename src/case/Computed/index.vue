<template>
    <h1>{{list}}</h1>
    <h1>{{list1}}</h1>
    <h1>{{list2}}</h1>
    <button @click="getList">Add</button>
</template>

<script>
export default {
    data(){
        return {
            list: 0,
            list1: 1,
            list2: 2
        }
    },
    // computed: {
    //     active(){
    //         this.getList(); // 该函数内部调用了list，所以当click修改了list时，会触发active computed重新执行
    //         return "Active" + this.list;
    //     }
    // },
    methods: {
        getList(){
            this.list = 10;
            this.list2 = 11;
        }
    }
}
</script>

<style>

</style>