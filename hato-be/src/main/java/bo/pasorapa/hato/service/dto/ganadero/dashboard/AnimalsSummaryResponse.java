package bo.pasorapa.hato.service.dto.ganadero.dashboard;

public record AnimalsSummaryResponse(CategoryCount machos, CategoryCount hembras) {

    public record CategoryCount(int vaquillas, int vacas, int toros, int terneros, int terneras, int bueyes) {
    }
}
