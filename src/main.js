import App from './App.svelte';

const app = new App({
	target: document.body,
	props: {
		name: 'Custom Search Library'
	}
});

export default app;