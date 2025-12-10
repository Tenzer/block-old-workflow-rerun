import * as core from "@actions/core";
import * as github from "@actions/github";

try {
  const token = core.getInput("token", { required: true });
  const octokit = github.getOctokit(token);

  core.debug(
    `Fetching workflow runs for owner "${github.context.owner}", repo "${github.context.repo}", workflow "${github.context.workflow}", branch "${core.getInput("branch")}"`,
  );

  const workflowRuns = await octokit.rest.actions.listWorkflowRuns({
    owner: github.context.owner,
    repo: github.context.repo,
    workflow_id: github.context.workflow,
    branch: core.getInput("branch") || "",
    per_page: 100,
  });

  // Statuses which indicate a workflow run has started or already run.
  // If a more newer workflow run has one of these statuses,
  // the workflow run this action is running for will be marked as failed.
  const statuses = [
    "completed",
    "failure",
    "in_progress",
    "startup_failure",
    "waiting",
  ];

  for (const workflowRun of workflowRuns.data.workflow_runs) {
    // Stop processing any more if we have reached the current workflow run
    if (workflowRun.id <= github.context.workflow.id) {
      break;
    }

    if (statuses.includes(workflowRun.status)) {
      core.setFailed(
        `A newer workflow run has either started or already run: ${workflowRun.html_url}`,
      );
    }
  }
} catch (error) {
  core.debug(error);
  core.setFailed(error.message);
}
