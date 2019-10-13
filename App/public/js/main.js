
// DATA.GOV API CONNECTION:
// $(function() {
//     $.ajax({
//       url: "https://55SYabUUoORJCAUl4xxIXqazV6lVs2g79Evqkncf@api.nal.usda.gov/fdc/v1/search",
//       contentType: 'application/json',
//       api_key: "55SYabUUoORJCAUl4xxIXqazV6lVs2g79Evqkncf",
//       generalSearchInput: "banana",
//       success: function(results){
//         console.log(results)
//       }
//   });
// });

// $(".ajax-trigger-love").click(function() {
// 	var $this = $(this);
//     var recipeId = $this.data('recipe-id');
//     console.log("this is the recipe id" + recipeId)
//     $.ajax({
//       url: "/recipes/"+ recipeId + "/love",
//       method: "POST",
//       contentType: 'application/json',
//       success: function(response){
//       	console.log("done")
//       }
//   });
// });