<script>
	export let name;
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

    fetch("http://127.0.0.1:5000/indexurl", {
      method: "POST",
      body:  dataArray
    })
      .then(response => {
        uploadResponse = `successfully indexed
        `;
      })
      .catch(error => {
        uploadResponse = `index unsuccessful`;
      });
  };





	    function search(event){
		event.preventDefault();

		const dataArray = new FormData();
    	dataArray.append("searchTerm", searchVar);
		dataArray.append("searchIndexName", searchIdxVar);
		
    	fetch('http://127.0.0.1:5000/search',{
     	 method: "POST",
     	 body:  dataArray
    })
	.then(function (response){
		return response.json();
	})
	.then(function (data){
		displayResults(data);
	})
      .catch(error => {
        uploadResponse = `unsuccessful
          `;
      });
  };


 

  function displayResults(data){
	var newWin = window.open('', '') 
	newWin.document.write(data)}





</script>


<main>
	<h1>{name}!</h1>
	<form on:submit={search}>
		<input
		  type="text"
		  bind:value={searchIdxVar}
		  placeholder={"which index do you want to search?"}
		/>
		<input
		  type="text"
		  bind:value={searchVar}
		  placeholder={"search..."}
		/>
		<input type="submit" />
	  </form>


	<form on:submit={indexUrl}>
		<input
		  type="text"
		  bind:value={idxNameVar}
		  placeholder={"index name"}
		/>
		<input
		  type="text"
		  bind:value={urlVar}
		  placeholder={"url"}
		/>
		<input type="submit" />
	  </form>
	  <hr />
	  <pre>{uploadResponse}</pre>
	  
</main>

<style>
	main {
		text-align: center;
		padding: 1em;
		max-width: 240px;
		margin: 0 auto;
	}

	h1 {
		color: #030303;
		text-transform: uppercase;
		font-size: 3em;
		font-weight: 100;
	}

	@media (min-width: 640px) {
		main {
			max-width: none;
		}
	}

	
</style>