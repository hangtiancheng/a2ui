export function createAgentCard(baseUrl: string) {
	return {
		name: "Restaurant Agent",
		description: "This agent helps find restaurants based on user criteria.",
		url: baseUrl,
		version: "1.0.0",
		defaultInputModes: ["text/plain"],
		defaultOutputModes: ["text/plain"],
		capabilities: {
			streaming: true,
			extensions: [
				{
					uri: "https://a2ui.org/a2a-extension/a2ui/v0.9",
					params: {
						catalogs: [
							"https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json",
						],
					},
				},
			],
		},
		skills: [
			{
				id: "find_restaurants",
				name: "Find Restaurants Tool",
				description:
					"Helps find restaurants based on user criteria (e.g., cuisine, location).",
				tags: ["restaurant", "finder"],
				examples: ["Find me the top 10 chinese restaurants in the US"],
			},
		],
	};
}
