from django.core.management.base import BaseCommand

from workspace.services.projeto_tiflux_service import sincronizar_tickets_com_projetos
from workspace.services.service_tickets import obter_dados_tickets


class Command(BaseCommand):
    help = "Cria e vincula projetos em rascunho a partir dos tickets elegíveis do TiFlux."

    def add_arguments(self, parser):
        parser.add_argument(
            "--refresh",
            action="store_true",
            help="Ignora o cache e atualiza o CSV do TiFlux antes da sincronização.",
        )
        parser.add_argument(
            "--simular",
            action="store_true",
            help="Analisa e enriquece os tickets sem criar projetos.",
        )

    def handle(self, *args, **options):
        dados = obter_dados_tickets(forcar_atualizacao=options["refresh"])
        if not dados.get("sucesso"):
            self.stderr.write(self.style.ERROR(dados.get("erro") or "Fonte TiFlux indisponível."))
            return
        resumo = sincronizar_tickets_com_projetos(
            dados.get("tickets", []),
            criar_rascunhos=not options["simular"],
        )
        self.stdout.write(self.style.SUCCESS(
            "Sincronização concluída: "
            f"{resumo['total_analisados']} analisados, "
            f"{resumo['tickets_elegiveis']} elegíveis, "
            f"{resumo['projetos_criados']} projetos criados, "
            f"{resumo['projetos_existentes_vinculados']} existentes vinculados, "
            f"{resumo['tickets_vinculados']} vinculados e "
            f"{resumo['erros']} erros."
        ))
