import * as core from "@actions/core";
import { context, getOctokit } from "@actions/github";

try {
  const token = core.getInput("token", { required: true });
  const octokit = getOctokit(token);
  const branch = core.getInput("branch");

  const workflow = await octokit.rest.actions.getWorkflow({
    owner: context.repo.owner,
    repo: context.repo.repo,
    run_id: context.runId,
  });
  const workflowId = workflow.data.workflow.id;

  core.debug(
    `Fetching workflow runs for owner: ${context.repo.owner}\nRepository: ${context.repo.repo}\nWorkflow ID: ${workflowId}\nBranch: ${branch}`,
  );

  const workflowRuns = await octokit.rest.actions.listWorkflowRuns({
    owner: context.repo.owner,
    repo: context.repo.repo,
    workflow_id: workflowId,
    branch: branch,
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
    if (workflowRun.id <= context.runId) {
      break;
    }

    if (statuses.includes(workflowRun.status)) {
      core.setFailed(
        `A newer workflow run has either started or already run: ${workflowRun.html_url}`,
      );
    }
  }
} catch (error) {
  core.setFailed(error.message);
}
