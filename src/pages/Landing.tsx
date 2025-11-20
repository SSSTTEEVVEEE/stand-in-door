import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const Landing = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="max-w-2xl text-center space-y-8">
        <div>
          <h1 className="text-6xl md:text-8xl font-bold mb-4">STAND</h1>
          <p className="text-muted-foreground text-sm tracking-widest uppercase mb-2">
            in the door
          </p>
          <p className="text-lg text-foreground/80 max-w-xl mx-auto">
            A zero-knowledge encrypted task management system. Your data, your control, your privacy.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button 
            size="lg" 
            className="font-bold text-lg px-8"
            onClick={() => navigate("/auth")}
          >
            DEPLOY
          </Button>
          <Button 
            size="lg" 
            variant="outline" 
            className="font-bold text-lg px-8"
            onClick={() => navigate("/terms")}
          >
            TERMS
          </Button>
        </div>

        <div className="mt-12 text-sm text-muted-foreground space-y-2 max-w-md mx-auto">
          <p className="font-semibold">What We Collect:</p>
          <p>All data is entirely self-input by you. We collect only what you choose to enter:</p>
          <ul className="list-disc list-inside space-y-1 text-left">
            <li>Tasks and chores you create</li>
            <li>Checklists and calendar events you add</li>
            <li>Email address for authentication</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Landing;
