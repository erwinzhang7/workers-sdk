// flue-blueprint: channel/github@1
import { createGitHubChannel } from "@flue/github";
import { defineTool } from "@flue/runtime";
import { Octokit } from "@octokit/rest";
import { env } from "cloudflare:workers";
import * as v from "valibot";

export const client = new Octokit({
	auth: env.GITHUB_TOKEN,
});

export const channel = createGitHubChannel({
	// Signature verification happens before this callback. Event-specific
	// dispatch will be added alongside the first triage behaviour.
	webhook: () => undefined,
	webhookSecret: env.GITHUB_WEBHOOK_SECRET,
});

/**
 * Creates a tool scoped to one verified GitHub issue or pull request
 */
export function commentOnIssue(ref: {
	issueNumber: number;
	owner: string;
	repo: string;
}) {
	return defineTool({
		description: `Comment on the GitHub issue or pull request bound to this agent.`,
		input: v.object({
			body: v.pipe(v.string(), v.minLength(1)),
		}),
		name: "comment_on_github_issue",
		run: async ({ data }) => {
			const result = await client.rest.issues.createComment({
				body: data.body,
				issue_number: ref.issueNumber,
				owner: ref.owner,
				repo: ref.repo,
			});

			return {
				output: {
					commentId: result.data.id,
					url: result.data.html_url,
				},
			};
		},
	});
}
