import * as core from "@actions/core";
import { context, getOctokit } from "@actions/github";

try {
  const token = core.getInput("token", { required: true });
  const octokit = getOctokit(token);
  const branch = core.getInput("branch");
  const failOnOldRerun = core.getBooleanInput("fail-on-old-rerun");

  const workflow = await octokit.rest.actions.getWorkflow({
    owner: context.repo.owner,
    repo: context.repo.repo,
    run_id: context.runId,
  });
  const workflowId = workflow.data.workflows[0].id;

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

  core.debug(`This workflow run ID is: ${context.runId}`);

  let allowed = true;
  for (const workflowRun of workflowRuns.data.workflow_runs) {
    core.debug(
      `Checking if workflow run ID ${workflowRun.id} with a status of ${workflowRun.status} is newer`,
    );

    // Stop processing any more if we have reached the current workflow run
    if (workflowRun.id <= context.runId) {
      core.debug("Current or older workflow run ID found");
      break;
    }

    if (statuses.includes(workflowRun.status)) {
      allowed = false;
      core.setOutput("allowed", false);
      if (failOnOldRerun) {
        core.setFailed(
          `A newer workflow run has either started or already completed: ${workflowRun.html_url}`,
        );
      }
      break;
    }
  }

  if (allowed) {
    core.setOutput("allowed", true);
  }
} catch (error) {
  core.setFailed(`An error occurred: ${error.message}`);
}
