import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	getWgClients,
	getWgInterfaces,
	createWgInterface,
	updateWgInterface,
	deleteWgInterface,
	updateWgInterfaceLinks,
	createWgClient,
	deleteWgClient,
	enableWgClient,
	disableWgClient,
	type WgClient,
	type WgInterface,
} from "src/api/backend/wireguard";

export const useWgClients = (options = {}) => {
	return useQuery<WgClient[], Error>({
		queryKey: ["wg-clients"],
		queryFn: getWgClients,
		refetchInterval: 5000,
		staleTime: 3000,
		...options,
	});
};

export const useWgInterfaces = (options = {}) => {
	return useQuery<WgInterface[], Error>({
		queryKey: ["wg-interfaces"],
		queryFn: getWgInterfaces,
		refetchInterval: 10000,
		staleTime: 5000,
		...options,
	});
};

export const useCreateWgInterface = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (data: { mtu?: number; dns?: string; host?: string; isolate_clients?: boolean; linked_servers?: number[] }) => createWgInterface(data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["wg-interfaces"] });
		},
	});
};

export const useUpdateWgInterface = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ id, data }: { id: number; data: { mtu?: number; dns?: string; host?: string; isolate_clients?: boolean; linked_servers?: number[] } }) => updateWgInterface(id, data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["wg-interfaces"] });
		},
	});
};

export const useDeleteWgInterface = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (id: number) => deleteWgInterface(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["wg-interfaces"] });
			queryClient.invalidateQueries({ queryKey: ["wg-clients"] });
		},
	});
};

export const useUpdateWgInterfaceLinks = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ id, data }: { id: number; data: { linked_servers: number[] } }) => updateWgInterfaceLinks(id, data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["wg-interfaces"] });
		},
	});
};


export const useCreateWgClient = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (data: { name: string; interface_id?: number }) => createWgClient(data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["wg-clients"] });
		},
	});
};

export const useDeleteWgClient = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (id: number) => deleteWgClient(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["wg-clients"] });
		},
	});
};

export const useToggleWgClient = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) =>
			enabled ? enableWgClient(id) : disableWgClient(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["wg-clients"] });
		},
	});
};
