
<script>
import { defineComponent, mergeProps, h, defineProps } from "@vue/runtime-core";
export default defineComponent({
    props: ["name"],
    setup(props) {
        return mergeProps(props, {age: 12})
    },
    render() {
        return h("div", {name: "Kpop"}, [ h("span", this.name), "-", h("span", this.age)])
    }
});
</script>
