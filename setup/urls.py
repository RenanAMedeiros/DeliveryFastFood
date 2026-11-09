from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.contrib.auth import views as auth_views
from django.urls import include, path, reverse_lazy

from customauth.forms import CustomPasswordResetForm
from customauth.views import ResetSenhaCompleteView, ResetSenhaConfirmView, esqueci_minha_senha, home, login, request_logout


urlpatterns = [
    path("", home, name="home_root"),
    path("home/", home, name="home"),
    path("", include("workspace.urls")),
    path("admin/", admin.site.urls),
    path("hijack/", include("hijack.urls")),
    path("login/", login, name="login"),
    path("logout/", request_logout, name="logout"),
    path("registration/esqueci_minha_senha/", esqueci_minha_senha, name="esqueci_minha_senha"),
    path(
        "password_reset/",
        auth_views.PasswordResetView.as_view(
            template_name="registration/esqueci_minha_senha.html",
            form_class=CustomPasswordResetForm,
            email_template_name="registration/password_reset_email.txt",
            html_email_template_name="registration/password_reset_email.html",
            subject_template_name="registration/password_reset_subject.txt",
            success_url="/password_reset/done/",
        ),
        name="password_reset",
    ),
    path(
        "registration/password_change/",
        auth_views.PasswordChangeView.as_view(
            template_name="registration/password_change_workspace.html",
            success_url=reverse_lazy("password_change_done"),
        ),
        name="reset_senha_logado",
    ),
    path("password_reset/done/", auth_views.PasswordResetDoneView.as_view(), name="password_reset_done"),
    path("reset/<uidb64>/<token>/", ResetSenhaConfirmView.as_view(), name="password_reset_confirm"),
    path("reset/done/", ResetSenhaCompleteView.as_view(), name="password_reset_complete"),
    path(
        "password_change/",
        auth_views.PasswordChangeView.as_view(
            template_name="registration/password_change_workspace.html",
            success_url=reverse_lazy("password_change_done"),
        ),
        name="password_change",
    ),
    path(
        "password_change/done/",
        auth_views.PasswordChangeDoneView.as_view(
            template_name="registration/password_change_workspace_done.html",
        ),
        name="password_change_done",
    ),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
