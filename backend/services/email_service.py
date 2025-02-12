from django.core.mail import send_mail
from django.conf import settings
from django.template.loader import render_to_string
from typing import List, Optional

class EmailService:
    @staticmethod
    def send_email(
        subject: str,
        message: str,
        recipient_list: List[str],
        html_message: Optional[str] = None
    ) -> bool:
        try:
            send_mail(
                subject=subject,
                message=message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=recipient_list,
                html_message=html_message
            )
            return True
        except Exception as e:
            print(f"Erreur lors de l'envoi de l'email: {str(e)}")
            return False

    @staticmethod
    def send_temporary_credentials(user, password: str) -> bool:
        subject = "Vos identifiants de connexion - IrrigationDesign"
        context = {
            'username': user.username,
            'password': password,
            'login_url': settings.FRONTEND_URL + '/login'
        }
        
        html_message = render_to_string('emails/temporary_credentials.html', context)
        text_message = render_to_string('emails/temporary_credentials.txt', context)
        
        return EmailService.send_email(
            subject=subject,
            message=text_message,
            recipient_list=[user.email],
            html_message=html_message
        )

    @staticmethod
    def send_password_reset(user, reset_token: str) -> bool:
        subject = "Réinitialisation de votre mot de passe - IrrigationDesign"
        reset_url = f"{settings.FRONTEND_URL}/reset-password/{reset_token}"
        
        context = {
            'username': user.username,
            'reset_url': reset_url
        }
        
        html_message = render_to_string('emails/password_reset.html', context)
        text_message = render_to_string('emails/password_reset.txt', context)
        
        return EmailService.send_email(
            subject=subject,
            message=text_message,
            recipient_list=[user.email],
            html_message=html_message
        )

    @staticmethod
    def send_admin_notification(subject: str, message: str, admin_emails: List[str]) -> bool:
        html_message = render_to_string('emails/admin_notification.html', {
            'message': message
        })
        
        return EmailService.send_email(
            subject=f"[Admin] {subject}",
            message=message,
            recipient_list=admin_emails,
            html_message=html_message
        ) 