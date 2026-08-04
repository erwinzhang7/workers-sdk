"use agent";

import { type Agent, useInitialData, useModel } from "@flue/runtime";
import * as v from "valibot";

const InitialData = v.object({
	issueNumber: v.number(),
	openedBy: v.string(),
	owner: v.string(),
	repo: v.string(),
	title: v.string(),
});

export const GithubAssistant: Agent = () => {
	useModel("cloudflare/@cf/moonshotai/kimi-k2.6");

	const data = useInitialData<v.InferOutput<typeof InitialData>>();
	if (!data) {
		throw new Error("The GitHub channel must create this agent.");
	}

	return `This placeholder agent represents ${data.owner}/${data.repo}#${data.issueNumber}, titled "${data.title}" and opened by ${data.openedBy}.
It has no tools and must not perform side effects.`;
};

GithubAssistant.agentName = "github-assistant";
GithubAssistant.initialData = InitialData;
