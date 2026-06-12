import { ProposalForm } from "@/components/proposals/proposalForm";

export default function NewProposalPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-heading mb-6 text-2xl font-bold">New proposal</h1>
      <ProposalForm mode="create" />
    </div>
  );
}
