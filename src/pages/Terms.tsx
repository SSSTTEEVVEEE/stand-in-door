import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const Terms = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <Button 
          variant="ghost" 
          className="mb-8 font-bold"
          onClick={() => navigate("/")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          BACK
        </Button>

        <Card className="p-8">
          <div className="space-y-6">
            <div>
              <h1 className="text-4xl font-bold mb-2">TERMS OF SERVICE</h1>
              <p className="text-sm text-muted-foreground uppercase tracking-widest">
                Stand in the Door
              </p>
            </div>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold">Data Collection & Privacy</h2>
              <div className="space-y-2 text-foreground/80">
                <p>
                  <strong>Your Rights:</strong> All data stored in this application is entirely self-input. 
                  You maintain complete control over your information.
                </p>
                <p>
                  <strong>What We Collect:</strong>
                </p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Email address for authentication purposes</li>
                  <li>Tasks, chores, and calendar events you create</li>
                  <li>Checklists and reminders you add</li>
                  <li>Authentication attempt metadata (for security)</li>
                </ul>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold">Zero-Knowledge Encryption</h2>
              <div className="space-y-2 text-foreground/80">
                <p>
                  This application implements zero-knowledge encryption principles:
                </p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Your data is encrypted on your device before transmission</li>
                  <li>Encryption keys are derived from your password</li>
                  <li>We cannot access your unencrypted data</li>
                  <li>Your password is never stored in plain text</li>
                </ul>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold">Your Rights</h2>
              <div className="space-y-2 text-foreground/80">
                <p>You have the right to:</p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Access all data you've created</li>
                  <li>Modify or delete your data at any time</li>
                  <li>Delete your account and all associated data</li>
                  <li>Export your data (functionality may vary)</li>
                </ul>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold">Security</h2>
              <div className="space-y-2 text-foreground/80">
                <p>
                  We implement industry-standard security measures including:
                </p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>PBKDF2 key derivation with 100,000 iterations</li>
                  <li>AES-256-GCM encryption for all sensitive data</li>
                  <li>Row-level security policies on database</li>
                  <li>Failed authentication attempt monitoring</li>
                  <li>Pseudonymized user identifiers to protect privacy</li>
                </ul>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold">Service Terms</h2>
              <div className="space-y-2 text-foreground/80">
                <p>
                  By using this service, you agree to:
                </p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Use the service for lawful purposes only</li>
                  <li>Maintain the security of your account credentials</li>
                  <li>Accept that password recovery is not possible due to encryption</li>
                  <li>Understand that we cannot recover lost passwords or decrypt your data without them</li>
                </ul>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold">Important Notice</h2>
              <div className="space-y-2 text-foreground/80">
                <p className="font-semibold">
                  Due to zero-knowledge encryption, if you lose your password, your encrypted data cannot be recovered. 
                  Please store your password securely.
                </p>
              </div>
            </section>

            <section className="space-y-2 text-sm text-muted-foreground">
              <p>Last Updated: {new Date().toLocaleDateString()}</p>
              <p>
                For questions or concerns, please contact us through the application feedback system.
              </p>
            </section>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Terms;
