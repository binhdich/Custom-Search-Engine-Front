
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function custom_event(type, detail, { bubbles = false, cancelable = false } = {}) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, cancelable, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            while (flushidx < dirty_components.length) {
                const component = dirty_components[flushidx];
                flushidx++;
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.48.0' }, detail), { bubbles: true }));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /* src\App.svelte generated by Svelte v3.48.0 */

    const file = "src\\App.svelte";

    function create_fragment(ctx) {
    	let main;
    	let h1;
    	let t0;
    	let t1;
    	let t2;
    	let form0;
    	let input0;
    	let t3;
    	let input1;
    	let t4;
    	let input2;
    	let t5;
    	let form1;
    	let input3;
    	let t6;
    	let input4;
    	let t7;
    	let input5;
    	let t8;
    	let hr;
    	let t9;
    	let pre;
    	let t10;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			main = element("main");
    			h1 = element("h1");
    			t0 = text(/*name*/ ctx[0]);
    			t1 = text("!");
    			t2 = space();
    			form0 = element("form");
    			input0 = element("input");
    			t3 = space();
    			input1 = element("input");
    			t4 = space();
    			input2 = element("input");
    			t5 = space();
    			form1 = element("form");
    			input3 = element("input");
    			t6 = space();
    			input4 = element("input");
    			t7 = space();
    			input5 = element("input");
    			t8 = space();
    			hr = element("hr");
    			t9 = space();
    			pre = element("pre");
    			t10 = text(/*uploadResponse*/ ctx[5]);
    			attr_dev(h1, "class", "svelte-1o6q9pa");
    			add_location(h1, file, 75, 1, 1212);
    			attr_dev(input0, "type", "text");
    			attr_dev(input0, "placeholder", "which index do you want to search?");
    			add_location(input0, file, 77, 2, 1258);
    			attr_dev(input1, "type", "text");
    			attr_dev(input1, "placeholder", "search...");
    			add_location(input1, file, 82, 2, 1373);
    			attr_dev(input2, "type", "submit");
    			add_location(input2, file, 87, 2, 1460);
    			add_location(form0, file, 76, 1, 1230);
    			attr_dev(input3, "type", "text");
    			attr_dev(input3, "placeholder", "index name");
    			add_location(input3, file, 92, 2, 1528);
    			attr_dev(input4, "type", "text");
    			attr_dev(input4, "placeholder", "url");
    			add_location(input4, file, 97, 2, 1617);
    			attr_dev(input5, "type", "submit");
    			add_location(input5, file, 102, 2, 1695);
    			add_location(form1, file, 91, 1, 1498);
    			add_location(hr, file, 104, 3, 1733);
    			add_location(pre, file, 105, 3, 1743);
    			attr_dev(main, "class", "svelte-1o6q9pa");
    			add_location(main, file, 74, 0, 1204);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, h1);
    			append_dev(h1, t0);
    			append_dev(h1, t1);
    			append_dev(main, t2);
    			append_dev(main, form0);
    			append_dev(form0, input0);
    			set_input_value(input0, /*searchIdxVar*/ ctx[4]);
    			append_dev(form0, t3);
    			append_dev(form0, input1);
    			set_input_value(input1, /*searchVar*/ ctx[3]);
    			append_dev(form0, t4);
    			append_dev(form0, input2);
    			append_dev(main, t5);
    			append_dev(main, form1);
    			append_dev(form1, input3);
    			set_input_value(input3, /*idxNameVar*/ ctx[2]);
    			append_dev(form1, t6);
    			append_dev(form1, input4);
    			set_input_value(input4, /*urlVar*/ ctx[1]);
    			append_dev(form1, t7);
    			append_dev(form1, input5);
    			append_dev(main, t8);
    			append_dev(main, hr);
    			append_dev(main, t9);
    			append_dev(main, pre);
    			append_dev(pre, t10);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input0, "input", /*input0_input_handler*/ ctx[8]),
    					listen_dev(input1, "input", /*input1_input_handler*/ ctx[9]),
    					listen_dev(form0, "submit", /*search*/ ctx[7], false, false, false),
    					listen_dev(input3, "input", /*input3_input_handler*/ ctx[10]),
    					listen_dev(input4, "input", /*input4_input_handler*/ ctx[11]),
    					listen_dev(form1, "submit", /*indexUrl*/ ctx[6], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*name*/ 1) set_data_dev(t0, /*name*/ ctx[0]);

    			if (dirty & /*searchIdxVar*/ 16 && input0.value !== /*searchIdxVar*/ ctx[4]) {
    				set_input_value(input0, /*searchIdxVar*/ ctx[4]);
    			}

    			if (dirty & /*searchVar*/ 8 && input1.value !== /*searchVar*/ ctx[3]) {
    				set_input_value(input1, /*searchVar*/ ctx[3]);
    			}

    			if (dirty & /*idxNameVar*/ 4 && input3.value !== /*idxNameVar*/ ctx[2]) {
    				set_input_value(input3, /*idxNameVar*/ ctx[2]);
    			}

    			if (dirty & /*urlVar*/ 2 && input4.value !== /*urlVar*/ ctx[1]) {
    				set_input_value(input4, /*urlVar*/ ctx[1]);
    			}

    			if (dirty & /*uploadResponse*/ 32) set_data_dev(t10, /*uploadResponse*/ ctx[5]);
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function displayResults(data) {
    	var newWin = window.open('', '');
    	newWin.document.write(data);
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	let { name } = $$props;
    	let urlVar;
    	let idxNameVar;
    	let searchVar;
    	let searchIdxVar;
    	let uploadResponse = "";

    	function indexUrl(event) {
    		event.preventDefault();
    		const dataArray = new FormData();
    		dataArray.append("indexUrl", urlVar);
    		dataArray.append("indexName", idxNameVar);

    		fetch("http://127.0.0.1:5000/indexurl", { method: "POST", body: dataArray }).then(response => {
    			$$invalidate(5, uploadResponse = `successfully indexed
        `);
    		}).catch(error => {
    			$$invalidate(5, uploadResponse = `index unsuccessful`);
    		});
    	}

    	function search(event) {
    		event.preventDefault();
    		const dataArray = new FormData();
    		dataArray.append("searchTerm", searchVar);
    		dataArray.append("searchIndexName", searchIdxVar);

    		fetch('http://127.0.0.1:5000/search', { method: "POST", body: dataArray }).then(function (response) {
    			return response.json();
    		}).then(function (data) {
    			displayResults(data);
    		}).catch(error => {
    			$$invalidate(5, uploadResponse = `unsuccessful
          `);
    		});
    	}
    	const writable_props = ['name'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	function input0_input_handler() {
    		searchIdxVar = this.value;
    		$$invalidate(4, searchIdxVar);
    	}

    	function input1_input_handler() {
    		searchVar = this.value;
    		$$invalidate(3, searchVar);
    	}

    	function input3_input_handler() {
    		idxNameVar = this.value;
    		$$invalidate(2, idxNameVar);
    	}

    	function input4_input_handler() {
    		urlVar = this.value;
    		$$invalidate(1, urlVar);
    	}

    	$$self.$$set = $$props => {
    		if ('name' in $$props) $$invalidate(0, name = $$props.name);
    	};

    	$$self.$capture_state = () => ({
    		name,
    		urlVar,
    		idxNameVar,
    		searchVar,
    		searchIdxVar,
    		uploadResponse,
    		indexUrl,
    		search,
    		displayResults
    	});

    	$$self.$inject_state = $$props => {
    		if ('name' in $$props) $$invalidate(0, name = $$props.name);
    		if ('urlVar' in $$props) $$invalidate(1, urlVar = $$props.urlVar);
    		if ('idxNameVar' in $$props) $$invalidate(2, idxNameVar = $$props.idxNameVar);
    		if ('searchVar' in $$props) $$invalidate(3, searchVar = $$props.searchVar);
    		if ('searchIdxVar' in $$props) $$invalidate(4, searchIdxVar = $$props.searchIdxVar);
    		if ('uploadResponse' in $$props) $$invalidate(5, uploadResponse = $$props.uploadResponse);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		name,
    		urlVar,
    		idxNameVar,
    		searchVar,
    		searchIdxVar,
    		uploadResponse,
    		indexUrl,
    		search,
    		input0_input_handler,
    		input1_input_handler,
    		input3_input_handler,
    		input4_input_handler
    	];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, { name: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*name*/ ctx[0] === undefined && !('name' in props)) {
    			console.warn("<App> was created without expected prop 'name'");
    		}
    	}

    	get name() {
    		throw new Error("<App>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set name(value) {
    		throw new Error("<App>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    const app = new App({
    	target: document.body,
    	props: {
    		name: 'Custom Search Library'
    	}
    });

    return app;

})();
//# sourceMappingURL=bundle.js.map
