package bo.pasorapa.hato.service;

import bo.pasorapa.hato.domain.Raza;
import bo.pasorapa.hato.domain.enumeration.RazaTipo;
import bo.pasorapa.hato.repository.RazaRepository;
import bo.pasorapa.hato.service.dto.raza.CreateRazaRequest;
import bo.pasorapa.hato.service.dto.raza.RazaOptionResponse;
import bo.pasorapa.hato.service.dto.raza.RazaResponse;
import bo.pasorapa.hato.service.dto.raza.UpdateRazaRequest;
import bo.pasorapa.hato.service.error.BusinessException;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.core.Response;
import java.text.Normalizer;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@ApplicationScoped
public class RazaService {

    private final RazaRepository razaRepository;

    public RazaService(RazaRepository razaRepository) {
        this.razaRepository = razaRepository;
    }

    public List<RazaResponse> listAll() {
        return razaRepository.findAllOrdered().stream().map(this::toResponse).toList();
    }

    public List<RazaOptionResponse> listActiveOptions() {
        return razaRepository.findAllActiveOrdered().stream().map(this::toOption).toList();
    }

    public RazaResponse findByUuid(UUID uuid) {
        return toResponse(findEntity(uuid));
    }

    @Transactional
    public RazaResponse create(CreateRazaRequest request) {
        String nombre = cleanRequiredName(request.nombre());
        String normalized = normalizeName(nombre);
        rejectDuplicate(normalized, null);

        Raza raza = new Raza();
        raza.setNombre(nombre);
        raza.setNombreNormalizado(normalized);
        raza.setDescripcion(cleanOptional(request.descripcion()));
        raza.setOrigen(cleanOptional(request.origen()));
        raza.setTipo(defaultTipo(request.tipo()));
        raza.setActivo(true);
        raza.setSortOrder(defaultSortOrder(request.sortOrder()));
        razaRepository.persist(raza);
        razaRepository.flush();
        return toResponse(raza);
    }

    @Transactional
    public RazaResponse update(UUID uuid, UpdateRazaRequest request) {
        Raza raza = findEntity(uuid);
        String nombre = cleanRequiredName(request.nombre());
        String normalized = normalizeName(nombre);
        rejectDuplicate(normalized, raza.getId());

        raza.setNombre(nombre);
        raza.setNombreNormalizado(normalized);
        raza.setDescripcion(cleanOptional(request.descripcion()));
        raza.setOrigen(cleanOptional(request.origen()));
        raza.setTipo(defaultTipo(request.tipo()));
        raza.setActivo(request.activo());
        raza.setSortOrder(defaultSortOrder(request.sortOrder()));
        razaRepository.flush();
        return toResponse(raza);
    }

    @Transactional
    public RazaResponse setActive(UUID uuid, boolean active) {
        Raza raza = findEntity(uuid);
        raza.setActivo(active);
        razaRepository.flush();
        return toResponse(raza);
    }

    private Raza findEntity(UUID uuid) {
        return razaRepository.findByUuid(uuid)
                .orElseThrow(() -> new BusinessException("RAZA_NOT_FOUND", "No encontramos la raza solicitada.", Response.Status.NOT_FOUND));
    }

    private void rejectDuplicate(String normalized, Long currentId) {
        razaRepository.findByNombreNormalizado(normalized).ifPresent(existing -> {
            if (currentId == null || !existing.getId().equals(currentId)) {
                throw new BusinessException("RAZA_DUPLICATE", "Ya existe una raza con ese nombre.", Response.Status.CONFLICT);
            }
        });
    }

    private String cleanRequiredName(String value) {
        String cleaned = cleanOptional(value);
        if (cleaned == null) {
            throw new BusinessException("RAZA_NAME_REQUIRED", "El nombre de la raza es obligatorio.", Response.Status.BAD_REQUEST);
        }
        return cleaned;
    }

    private String cleanOptional(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    private String normalizeName(String value) {
        String withoutAccents = Normalizer.normalize(value, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        return withoutAccents.toLowerCase(Locale.ROOT).trim().replaceAll("\\s+", " ");
    }

    private Integer defaultSortOrder(Integer sortOrder) {
        return sortOrder == null ? 1000 : sortOrder;
    }

    private RazaTipo defaultTipo(RazaTipo tipo) {
        return tipo == null ? RazaTipo.UNCLASSIFIED : tipo;
    }

    private RazaResponse toResponse(Raza raza) {
        return new RazaResponse(
                raza.getUuid(),
                raza.getNombre(),
                raza.getDescripcion(),
                raza.getOrigen(),
                raza.getTipo(),
                raza.getActivo(),
                raza.getSortOrder(),
                raza.getVersion(),
                raza.getCreatedAt(),
                raza.getUpdatedAt());
    }

    private RazaOptionResponse toOption(Raza raza) {
        return new RazaOptionResponse(raza.getUuid(), raza.getNombre(), raza.getOrigen(), raza.getTipo(), raza.getSortOrder());
    }
}
