import { EmailTemplate } from "@/components/email-template";
import { config } from "@/data/config";
import { Resend } from "resend";
import { z } from "zod";

// Make this route dynamic to prevent build-time evaluation
export const dynamic = 'force-dynamic';

// Initialize Resend at runtime to avoid build errors
const getResendClient = () => {
  return new Resend(process.env.RESEND_API_KEY || 'dummy_key_for_build');
};

const Email = z.object({
  fullName: z.string().min(2, "Full name is invalid!"),
  email: z.string().email({ message: "Email is invalid!" }),
  message: z.string().min(10, "Message is too short!"),
});
export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log("Received request body:", body);
    
    const {
      success: zodSuccess,
      data: zodData,
      error: zodError,
    } = Email.safeParse(body);
    
    if (!zodSuccess) {
      console.error("Validation error:", zodError);
      return Response.json({ 
        error: "Validation failed", 
        details: zodError?.errors 
      }, { status: 400 });
    }

    // Check if API key is configured
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey || apiKey === 'dummy_key_for_build') {
      console.error("RESEND_API_KEY is not configured properly");
      return Response.json({ 
        error: "Email service not configured. Please contact the administrator.",
        details: "RESEND_API_KEY environment variable is missing or invalid"
      }, { status: 500 });
    }

    // Get Resend client at runtime
    const resend = getResendClient();
    console.log("Attempting to send email to:", config.email);
    
    const { data: resendData, error: resendError } = await resend.emails.send({
      from: "Porfolio <onboarding@resend.dev>",
      to: [config.email],
      subject: "Contact me from portfolio",
      react: EmailTemplate({
        fullName: zodData.fullName,
        email: zodData.email,
        message: zodData.message,
      }),
    });

    if (resendError) {
      console.error("Resend API error:", resendError);
      return Response.json({ 
        error: "Failed to send email",
        resendError,
        details: resendError.message || "Unknown error from email service"
      }, { status: 500 });
    }

    console.log("Email sent successfully:", resendData);
    return Response.json(resendData);
  } catch (error) {
    console.error("Unexpected error in POST /api/send:", error);
    return Response.json({ 
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}
